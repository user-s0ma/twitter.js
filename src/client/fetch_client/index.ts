export default class FetchSessionClient {
  private defaultHeaders: Record<string, string>;
  public cookies: Map<string, string>;

  constructor(defaultHeaders: Record<string, string> = {}) {
    this.defaultHeaders = defaultHeaders;
    this.cookies = new Map<string, string>();
  }

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  private setCookiesFromResponse(headers: Headers): void {
    const setCookieHeader = headers.get("set-cookie");
    if (setCookieHeader) {
      setCookieHeader.split(",").forEach(cookieString => {
        const [cookiePair] = cookieString.split(";");
        const [key, value] = cookiePair.split("=");
        if (key && value) {
          this.cookies.set(key.trim(), value.trim());
        }
      });
    }
  }

  public async request(
    method: string,
    url: string,
    options: {
      headers?: Record<string, string | undefined>;
      body?: string | FormData;
      queryParams?: Record<string, string>;
    } = {}
  ): Promise<Response> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options.headers,
      Cookie: this.getCookieHeader(),
    };

    if (options.queryParams) {
      const params = new URLSearchParams(options.queryParams).toString();
      url += `?${params}`;
    }

    const response = await fetch(url, {
      method,
      redirect: "follow",
      credentials: "include",
      headers,
      body: options.body,
    });

    this.setCookiesFromResponse(response.headers);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }
}