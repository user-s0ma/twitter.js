import FetchClient from "../fetch_client";

export async function handleXMigration(session: FetchClient, headers: any): Promise<string> {
  let response = await session.request("GET", "https://twitter.com", { headers });
  
  const metaRefreshMatch = response.match(/content="0;\s*url\s*=\s*([^"]+)"/);
  if (metaRefreshMatch) {
      const redirectUrl = metaRefreshMatch[1].trim();
      
      response = await session.request("GET", redirectUrl, { headers });

      const tokenMatch = response.match(/name="tok"\s+value="([^"]+)"/);
      if (tokenMatch) {
          const formData = new URLSearchParams();
          formData.append('tok', tokenMatch[1]);
          
          response = await session.request("POST", "https://x.com/x/migrate", {
              headers: {
                  ...headers,
                  'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: formData.toString()
          });
      }
  }
  
  return response;
}

export function floatToHex(x: number): string {
  const result: string[] = [];
  let quotient = Math.floor(x);
  let fraction = x - quotient;

  while (quotient > 0) {
    const remainder = quotient % 16;
    result.unshift(remainder > 9 ? String.fromCharCode(remainder + 55) : remainder.toString());
    quotient = Math.floor(quotient / 16);
  }

  if (fraction === 0) {
    return result.join("");
  }

  result.push(".");

  while (fraction > 0) {
    fraction *= 16;
    const integer = Math.floor(fraction);
    fraction -= integer;
    result.push(integer > 9 ? String.fromCharCode(integer + 55) : integer.toString());
  }

  return result.join("");
}

export function isOdd(num: number): number {
  return num % 2 ? -1.0 : 0.0;
}

export function base64Encode(input: string | ArrayBuffer): string {
  const buffer = typeof input === "string" ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(buffer))));
}

export function base64Decode(input: string): string | number[] {
  try {
    const binaryString = atob(input);
    return new TextDecoder().decode(Uint8Array.from(binaryString, (c) => c.charCodeAt(0)));
  } catch {
    return Array.from(new TextEncoder().encode(input));
  }
}