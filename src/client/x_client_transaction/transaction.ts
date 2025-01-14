import { Cubic } from "./cubic_curve";
import { interpolate } from "./interpolate";
import { convertRotationToMatrix } from "./rotation";
import { handleXMigration, floatToHex, isOdd, base64Encode } from "./utils";
import JSDOMParser, { HTMLElementRepresentation } from "../dom_parser";
import FetchClient from "../fetch_client";

const ON_DEMAND_FILE_REGEX = /['|"]{1}ondemand\.s['|"]{1}:\s*['|"]{1}([\w]*)['|"]{1}/m;
const INDICES_REGEX = /(\(\w{1}\[(\d{1,2})\],\s*16\))+/gm;

export default class ClientTransaction {
  private ADDITIONAL_RANDOM_NUMBER: number = 3;
  private DEFAULT_KEYWORD: string = "obfiowerehiring";
  private DEFAULT_ROW_INDEX: number | null = null;
  private DEFAULT_KEY_BYTES_INDICES: number[] | null = null;
  private key: string | null = null;
  private keyBytes: number[] | null = null;
  private animationKey: string | null = null;
  public homePageResponse: HTMLElementRepresentation | null = null;

  public async init(session: FetchClient, headers: any): Promise<void> {
    const homePageResponseText = await handleXMigration(session, headers);
    const parser = new JSDOMParser(homePageResponseText);
    this.homePageResponse = parser.root;
    [this.DEFAULT_ROW_INDEX, this.DEFAULT_KEY_BYTES_INDICES] = await this.getIndices(this.homePageResponse, session, headers);
    this.key = this.getKey(this.homePageResponse);
    this.keyBytes = this.getKeyBytes(this.key);
    this.animationKey = this.getAnimationKey(this.keyBytes, this.homePageResponse);
  }

  private async getIndices(homePageResponse: HTMLElementRepresentation, session: FetchClient, headers: any): Promise<[number, number[]]> {
    const keyByteIndices: number[] = [];
    const response = this.validateResponse(homePageResponse) || this.homePageResponse;
    const onDemandFile = ON_DEMAND_FILE_REGEX.exec(response.full);

    if (onDemandFile) {
      const onDemandFileUrl = `https://abs.twimg.com/responsive-web/client-web/ondemand.s.${onDemandFile[1]}a.js`;

      const onDemandFileResponse = await session.request("GET", onDemandFileUrl, { headers });
      const onDemandFileText = await onDemandFileResponse.text();

      const matches = Array.from(onDemandFileText.matchAll(INDICES_REGEX));

      for (const match of matches) {
        if (match[2]) {
          keyByteIndices.push(parseInt(match[2], 10));
        }
      }
    }

    if (keyByteIndices.length === 0) {
      throw new Error("Couldn't get KEY_BYTE indices");
    }

    return [keyByteIndices[0], keyByteIndices.slice(1)];
  }

  private validateResponse(response: HTMLElementRepresentation | null): HTMLElementRepresentation {
    if (!response || typeof response !== "object") {
      throw new Error("Invalid response");
    }
    return response;
  }

  private getKey(response: HTMLElementRepresentation): string {
    const element = response.querySelector("meta[name='twitter-site-verification']");
    if (!element) {
      throw new Error("Couldn't get key from the page source");
    }

    const content = element.getAttribute("content");
    if (!content) {
      throw new Error("No content attribute in twitter-site-verification meta tag");
    }

    return content;
  }

  private getKeyBytes(key: string): number[] {
    return Array.from(Uint8Array.from(atob(key), c => c.charCodeAt(0)));
  }

  private getAnimationKey(keyBytes: number[], response: HTMLElementRepresentation): string {
    if (!this.DEFAULT_ROW_INDEX || !this.DEFAULT_KEY_BYTES_INDICES) {
      throw new Error("Required indices not initialized");
    }

    const totalTime = 4096;
    const rowIndex = keyBytes[this.DEFAULT_ROW_INDEX] % 16;
    const frameTime = this.DEFAULT_KEY_BYTES_INDICES.reduce((acc, index) => {
      const keyByte = keyBytes[index];
      if (typeof keyByte !== "number") {
        throw new Error(`Invalid key byte at index ${index}`);
      }
      return acc * (keyByte % 16);
    }, 1);

    const arr = this.get2DArray(keyBytes, response);
    if (arr.length === 0) {
      throw new Error("No data available in 2D array");
    }

    const frameRow = arr[0];
    if (!frameRow || !Array.isArray(frameRow)) {
      throw new Error("Invalid frame row data");
    }

    const targetTime = frameTime / totalTime;

    return this.animate(frameRow, targetTime);
  }

  private get2DArray(keyBytes: number[], response: HTMLElementRepresentation): number[][] {
    const frames = this.getFrames(response);
    if (!frames || frames.length === 0) {
      throw new Error("No frames found in response");
    }

    const frameIndex = keyBytes[5] % frames.length;
    const frame = frames[frameIndex];

    if (!frame) {
      throw new Error(`Invalid frame index: ${frameIndex}`);
    }

    const paths = frame.querySelectorAll("path");
    if (!paths || paths.length === 0) {
      console.warn("Debug frame content:", frame.full);
      throw new Error("No path elements found in frame");
    }

    const extractNumbers = (pathStr: string): number[] => {
      const numbers = pathStr.match(/-?\d+(\.\d+)?/g);
      if (!numbers) {
        throw new Error(`No numbers found in path: ${pathStr}`);
      }
      return numbers.map(n => parseFloat(n));
    };

    let allNumbers: number[] = [];
    paths.forEach(path => {
      const dAttribute = path.getAttribute("d");
      if (!dAttribute) {
        console.warn("Path element missing 'd' attribute");
        return;
      }

      try {
        const numbers = extractNumbers(dAttribute);
        allNumbers = allNumbers.concat(numbers);
      } catch (error) {
        console.error("Error parsing path:", error);
      }
    });

    if (allNumbers.length < 10) {
      allNumbers = allNumbers.concat(Array(10 - allNumbers.length).fill(0));
    }

    const result = [allNumbers];
    return result;
  }

  private getFrames(response: HTMLElementRepresentation): HTMLElementRepresentation[] {
    return response.querySelectorAll("svg").filter(el =>
      el.getAttribute("id")?.includes("loading-x-anim")
    );
}

  private animate(frames: number[], targetTime: number): string {
    if (!Array.isArray(frames) || frames.length < 7) {
      throw new Error(`Invalid frames array: expected at least 7 elements, got ${frames?.length}`);
    }

    const fromColor = frames.slice(0, 3).map(val => val / 255);
    const toColor = frames.slice(3, 6).map(val => val / 255);
    const fromRotation = [0];
    const toRotation = [this.solveValue(frames[6], 60, 360, true)];

    const curves = frames.slice(7).map((val, idx) => this.solveValue(val, isOdd(idx), 1, false));
    const cubic = new Cubic(curves as [number, number, number, number]);
    const val = cubic.getValue(targetTime);

    const color = interpolate(fromColor, toColor, val).map(c => Math.max(0, c as number));
    const rotation = interpolate(fromRotation, toRotation, val);
    const matrix = convertRotationToMatrix(rotation[0] as number);

    const hexColor = color.slice(0, 3).map(c => Math.round(c as number).toString(16).padStart(2, "0")).join("");
    const hexMatrix = matrix.map(value => floatToHex(Math.abs(value))).join("");

    return `${hexColor}${hexMatrix}00`;
  }

  private solveValue(value: number, min: number, max: number, rounding: boolean): number {
    const result = (value * (max - min)) / 255 + min;
    return rounding ? Math.floor(result) : parseFloat(result.toFixed(2));
  }

  public async generateTransactionId(
    method: string,
    path: string,
    response: HTMLElementRepresentation | null = null,
    key: string | null = null,
    animationKey: string | null = null,
    timeNow: number | null = null
  ): Promise<string> {
    const now = timeNow || Math.floor((Date.now() - 1682924400000) / 1000);
    const timeBytes = Array.from({ length: 4 }, (_, i) => (now >> (i * 8)) & 0xFF);

    key = key || this.key || this.getKey(response!);
    const keyBytes = this.getKeyBytes(key);
    animationKey = animationKey || this.animationKey || this.getAnimationKey(keyBytes, response!);

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${method}!${path}!${now}${this.DEFAULT_KEYWORD}${animationKey}`)
    );
    const hashBytes = Array.from(new Uint8Array(hashBuffer));

    const randomNum = Math.floor(Math.random() * 256);
    const byteArray = new Uint8Array([
      randomNum,
      ...keyBytes.map(byte => byte ^ randomNum),
      ...timeBytes,
      ...hashBytes.slice(0, 16),
      this.ADDITIONAL_RANDOM_NUMBER
    ]);

    return base64Encode(byteArray.buffer).replace(/=+$/, "");
  }
}