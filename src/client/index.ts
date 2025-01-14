import ClientTransaction from "./x_client_transaction/transaction";
import FetchClient from "./fetch_client";
import { Flow } from "./utils";
import { V11Client } from "./v11";

const TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"

interface RequestOptions {
  headers?: Record<string, string | undefined>;
  autoUnlock?: boolean;
  raiseException?: boolean;
  data?: any;
  params?: Record<string, any>;
  [key: string]: any;
}

interface CardData {
  'twitter:card': string;
  'twitter:api:api:endpoint': string;
  'twitter:long:duration_minutes': number;
  [key: string]: string | number;
}

export interface TwitterBaseHeaders {
  "authorization"?: string;
  'content-type'?: string;
  'X-Twitter-Auth-Type'?: string;
  'X-Twitter-Active-User'?: string;
  'Referer'?: string;
  'User-Agent'?: string;

  'x-guest-token'?: string;
  'x-csrf-token'?: string;
  'LivePipeline-Session'?: string;
  'Accept-Language'?: string;
  'X-Twitter-Client-Language'?: string;
  'X-Act-As-User-Id'?: string;

  [key: string]: string | undefined;
}

export class Client {
  public v11: V11Client;
  public language: string;
  public proxy: string | null;
  public _token: string = TOKEN;
  public _userId: string | null = null;
  public _actAs: string | null = null;
  public _userAgent: string;
  private http: FetchClient;
  private clientTransaction: ClientTransaction;
  private captchaSolver: Capsolver | null;
  private gql: GQLClient;

  constructor(
    language: string = "en-US",
    proxy: string | null = null,
    captchaSolver: Capsolver | null = null,
    userAgent: string | null = null,
    options: Record<string, any> = {}
  ) {
    this.language = language;
    this.proxy = proxy;
    this.captchaSolver = captchaSolver;
    this._userAgent = userAgent || "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

    this.http = new FetchClient();
    this.clientTransaction = new ClientTransaction();

    if (this.captchaSolver) {
      this.captchaSolver.client = this;
    }

    this.gql = null//new GQLClient(this);
    this.v11 = new V11Client(this);
  }

  get _base_headers(): TwitterBaseHeaders {
    const headers: TwitterBaseHeaders = {
      authorization: `Bearer ${this._token}`,
      'content-type': 'application/json',
      'X-Twitter-Auth-Type': 'OAuth2Session',
      'X-Twitter-Active-User': 'yes',
      'Referer': 'https://x.com/',
      'User-Agent': this._userAgent,
    };

    if (this.language) {
      headers['Accept-Language'] = this.language;
      headers['X-Twitter-Client-Language'] = this.language;
    }

    const csrfToken = this.getCsrfToken();
    if (csrfToken) {
      headers['X-Csrf-Token'] = csrfToken;
    }

    if (this._actAs) {
      headers['X-Act-As-User-Id'] = this._actAs;
    }

    return headers;
  }

  private removeDuplicateCt0Cookie(): void {
    const cookies = new Map<string, string>();
    Array.from(this.http.cookies.entries()).forEach(([name, value]) => {
      if (name === "ct0" && cookies.has("ct0")) {
        return;
      }
      cookies.set(name, value);
    });
    this.http.cookies = cookies;
  }

  getCsrfToken(): string | null {
    return this.http.cookies.get('ct0') || null;
  }

  public async request(
    method: string,
    url: string,
    options: RequestOptions = {}
  ): Promise<[any, Response]> {
    const { headers = {}, autoUnlock = true, raiseException = true, ...restOptions } = options;

    if (!this.clientTransaction.homePageResponse) {
      const cookiesBackup = new Map(this.http.cookies);
      const ctHeaders = {
        "Accept-Language": `${this.language},${this.language.split("-")[0]};q=0.9`,
        "Cache-Control": "no-cache",
        "Referer": "https://x.com",
        "User-Agent": this._userAgent
      };
      await this.clientTransaction.init(this.http, ctHeaders);
      this.setCookies(cookiesBackup, true);
    }

    const tid = await this.clientTransaction.generateTransactionId(method, new URL(url).pathname);
    headers["X-Client-Transaction-Id"] = tid;

    const cookiesBackup = new Map(this.http.cookies);
    const response = await this.http.request(method, url, { ...restOptions, headers });
    this.removeDuplicateCt0Cookie();

    let responseData;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    if (typeof responseData === "object" && responseData?.errors) {
      const error = responseData.errors[0];
      if ([37, 64].includes(error?.code)) {
        throw new Error(`Account Suspended: ${error?.message}`);
      }

      if (error?.code === 326 && autoUnlock) {
        if (!this.captchaSolver) {
          throw new Error("Account Locked: Visit https://x.com/account/access to unlock it.");
        }

        await this.unlock();
        this.setCookies(cookiesBackup, true);
        return this.request(method, url, options);
      }
    }

    if (response.status >= 400 && raiseException) {
      const message = `HTTP Error ${response.status}: ${await response.text()}`;
      if (response.status === 400) {
        throw new Error(`Bad Request: ${message}`);
      } else if (response.status === 401) {
        throw new Error(`Unauthorized: ${message}`);
      } else if (response.status === 403) {
        throw new Error(`Forbidden: ${message}`);
      } else if (response.status === 404) {
        throw new Error(`Not Found: ${message}`);
      } else if (response.status === 429) {
        throw new Error(`Too Many Requests: ${message}`);
      } else {
        throw new Error(`Request Error: ${message}`);
      }
    }

    return [responseData, response];
  }

  public async get(url: string, options: RequestOptions = {}): Promise<[any, Response]> {
    return this.request('GET', url, options);
  }

  public async post(url: string, options: RequestOptions = {}): Promise<[any, Response]> {
    return this.request('POST', url, options);
  }

  private setCookies(cookies: Map<string, string>, clearCookies: boolean = false): void {
    if (clearCookies) {
      this.http.cookies = new Map();
    }
    cookies.forEach((value, key) => {
      this.http.cookies.set(key, value);
    });
  }

  private async _getGuestToken(): Promise<string> {
    const [response] = await this.v11.guestActivate();
    return response.guest_token;
  }

  private async _uiMetrics(): Promise<string> {
    const js = await this.get('https://twitter.com/i/js_inst?c_name=ui_metrics');
    const match = js[0].match(/return ({[\s\S]*?});/);
    return match ? match[1] : '';
  }

  public async unlock(): Promise<void> {
    if (!this.captchaSolver) {
      throw new Error('Captcha solver is not provided.');
    }

    let [response, html] = await this.captchaSolver.getUnlockHtml();

    if (html.deleteButton) {
      [response, html] = await this.captchaSolver.confirmUnlock(
        html.authenticityToken,
        html.assignmentToken,
        true
      );
    }

    if (html.startButton || html.finishButton) {
      [response, html] = await this.captchaSolver.confirmUnlock(
        html.authenticityToken,
        html.assignmentToken,
        true
      );
    }

    const cookiesBackup = new Map(this.http.cookies);
    const maxUnlockAttempts = this.captchaSolver.maxAttempts;
    let attempt = 0;

    while (attempt < maxUnlockAttempts) {
      attempt++;

      if (!html.authenticityToken) {
        [response, html] = await this.captchaSolver.getUnlockHtml();
      }

      const result = await this.captchaSolver.solveFuncaptcha(html.blob);
      if (result.errorId === 1) {
        continue;
      }

      this.setCookies(cookiesBackup, true);
      [response, html] = await this.captchaSolver.confirmUnlock(
        html.authenticityToken,
        html.assignmentToken,
        result.solution.token
      );

      if (html.finishButton) {
        [response, html] = await this.captchaSolver.confirmUnlock(
          html.authenticityToken,
          html.assignmentToken,
          true
        );
      }

      const finished = response.nextRequest?.url.pathname === '/';
      if (finished) {
        return;
      }
    }

    throw new Error('Could not unlock the account.');
  }

  public async login({
    authInfo1,
    authInfo2 = null,
    password,
    totpSecret = null
  }: {
    authInfo1: string;
    authInfo2?: string | null;
    password: string;
    totpSecret?: string | null;
  }): Promise<any> {
    this.http.cookies.clear();
    const guestToken = await this._getGuestToken();

    const flow = new Flow(this, guestToken);

    await flow.executeTask({
      subtask_id: "LoginJsInstrumentationSubtask",
      js_instrumentation: {
        response: await this._uiMetrics(),
        link: "next_link"
      }
    });

    await flow.executeTask({
      subtask_id: "LoginEnterUserIdentifierSSO",
      settings_list: {
        setting_responses: [
          {
            key: "user_identifier",
            response_data: {
              text_data: { result: authInfo1 }
            }
          }
        ],
        link: "next_link"
      }
    });

    if (flow.taskId === "LoginEnterAlternateIdentifierSubtask" && authInfo2) {
      await flow.executeTask({
        subtask_id: "LoginEnterAlternateIdentifierSubtask",
        enter_text: {
          text: authInfo2,
          link: "next_link"
        }
      });
    }

    if (flow.taskId === "DenyLoginSubtask") {
      throw new Error(flow.response?.subtasks[0]?.cta?.secondary_text?.text || "Login denied");
    }

    await flow.executeTask({
      subtask_id: "LoginEnterPassword",
      enter_password: {
        password,
        link: "next_link"
      }
    });

    if (flow.taskId === "DenyLoginSubtask") {
      throw new Error(flow.response?.subtasks[0]?.cta?.secondary_text?.text || "Login denied");
    }

    if (flow.taskId === "LoginAcid") {
      console.log(flow.response?.subtasks[0]?.cta?.secondary_text?.text);
      const userInput = await this.promptForInput(">>> ");
      await flow.executeTask({
        subtask_id: "LoginAcid",
        enter_text: {
          text: userInput,
          link: "next_link"
        }
      });
      return flow.response;
    }

    await flow.executeTask({
      subtask_id: "AccountDuplicationCheck",
      check_logged_in_account: {
        link: "AccountDuplicationCheck_false"
      }
    });

    if (!flow.response?.subtasks) {
      return;
    }

    this._userId = this.findUserId(flow.response);

    if (flow.taskId === "LoginTwoFactorAuthChallenge") {
      const totpCode = await this.handleTwoFactor(flow, totpSecret);
      await flow.executeTask({
        subtask_id: "LoginTwoFactorAuthChallenge",
        enter_text: {
          text: totpCode,
          link: "next_link"
        }
      });
    }

    return flow.response;
  }

  private async handleTwoFactor(flow: Flow, totpSecret: string | null): Promise<string> {
    if (!totpSecret) {
      console.log(flow.response?.subtasks[0]?.cta?.secondary_text?.text);
      return await this.promptForInput(">>> ");
    }
    return new TOTP(totpSecret).generate();
  }

  private findUserId(response: any): string | null {
    for (const task of response.subtasks || []) {
      if (task.id_str) {
        return task.id_str;
      }
    }
    return null;
  }

  private async promptForInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      const input = prompt || "";
      resolve(input);
    });
  }

  public async logout(): Promise<any> {
    const [response] = await this.v11.accountLogout();
    return response;
  }

  public async userId(): Promise<string> {
    if (this._userId) {
      return this._userId;
    }
    const [response] = await this.v11.settings();
    const screenName = response.screen_name;
    this._userId = (await this.getUserByScreenName(screenName)).id;
    return this._userId;
  }

  public async getUserByScreenName(screenName: string): Promise<User> {
    const [response] = await this.gql.userByScreenName(screenName);

    if (!response.data?.user) {
      throw new Error("User not found");
    }

    const userData = response.data.user.result;
    if (userData.__typename === "UserUnavailable") {
      throw new Error(userData.message || "User unavailable");
    }

    return new User(this, userData);
  }

  public async getUserById(userId: string): Promise<User> {
    const [response] = await this.gql.userByRestId(userId);

    if (!response.data?.user?.result) {
      throw new Error(`Invalid user id: ${userId}`);
    }

    const userData = response.data.user.result;
    if (userData.__typename === "UserUnavailable") {
      throw new Error(userData.message || "User unavailable");
    }

    return new User(this, userData);
  }

  public setDelegateAccount(userId: string | null): void {
    this._actAs = userId;
  }

  public getCookies(): Map<string, string> {
    return new Map(this.http.cookies);
  }

  public saveCookies(path: string): void {
    const cookiesObj = Object.fromEntries(this.http.cookies);
    fs.writeFileSync(path, JSON.stringify(cookiesObj), 'utf8');
  }

  public loadCookies(path: string): void {
    const cookiesObj = JSON.parse(fs.readFileSync(path, 'utf8'));
    this.setCookies(new Map(Object.entries(cookiesObj)));
  }

  async guestActivate(): Promise<[any, Response]> {
    const headers = { ...this._base_headers };
    delete headers['X-Twitter-Active-User'];
    delete headers['X-Twitter-Auth-Type'];

    return await this.post(
      'https://api.x.com/1.1/guest/activate.json',
      { headers, data: {} }
    );
  }

  async onboardingTask(
    guest_token: string,
    token: string | null,
    subtask_inputs: any[],
    data: Record<string, any> | null = null,
    options: Record<string, any> = {}
  ): Promise<[any, Response]> {
    const payload = {
      ...data,
      ...(token && { flow_token: token }),
      ...(subtask_inputs && { subtask_inputs })
    };

    const headers: TwitterBaseHeaders = {
      'x-guest-token': guest_token,
      'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
    };

    const csrf_token = this.getCsrfToken();
    if (csrf_token) {
      headers['x-csrf-token'] = csrf_token;
      headers['x-twitter-auth-type'] = 'OAuth2Session';
    }

    return await this.post(
      'https://api.x.com/1.1/onboarding/task.json',
      {
        json: payload,
        headers,
        ...options
      }
    );
  }

  async ssoInit(provider: string, guest_token: string): Promise<[any, Response]> {
    const headers = {
      ...this._base_headers,
      'x-guest-token': guest_token
    };
    delete headers['X-Twitter-Active-User'];
    delete headers['X-Twitter-Auth-Type'];

    return await this.post(
      'https://api.x.com/1.1/onboarding/sso_init.json',
      {
        json: { provider },
        headers
      }
    );
  }

  async uploadMedia(
    method: string,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<[any, Response]> {
    return await this.request(method, endpoint, options);
  }

  async uploadMediaWithType(
    method: string,
    is_long_video: boolean,
    options: Record<string, any> = {}
  ): Promise<[any, Response]> {
    const endpoint = is_long_video
      ? 'https://upload.x.com/i/media/upload2.json'
      : 'https://upload.x.com/i/media/upload.json';
    return await this.uploadMedia(method, endpoint, options);
  }

  async uploadMediaInit(
    media_type: string,
    total_bytes: number,
    media_category: string | null,
    is_long_video: boolean
  ): Promise<[any, Response]> {
    const params = {
      command: 'INIT',
      total_bytes,
      media_type,
      ...(media_category && { media_category })
    };

    return await this.uploadMediaWithType(
      'POST',
      is_long_video,
      {
        params,
        headers: this._base_headers
      }
    );
  }

  async uploadMediaAppend(
    is_long_video: boolean,
    media_id: string,
    segment_index: number,
    chunk_stream: any
  ): Promise<[any, Response]> {
    const params = {
      command: 'APPEND',
      media_id,
      segment_index,
    };

    const headers = { ...this._base_headers };
    delete headers['content-type'];

    const files = {
      media: ['blob', chunk_stream, 'application/octet-stream']
    };

    return await this.uploadMediaWithType(
      'POST',
      is_long_video,
      { params, headers, files }
    );
  }

  async uploadMediaFinelize(
    is_long_video: boolean,
    media_id: string
  ): Promise<[any, Response]> {
    const params = {
      command: 'FINALIZE',
      media_id
    };

    return await this.uploadMediaWithType(
      'POST',
      is_long_video,
      {
        params,
        headers: this._base_headers
      }
    );
  }

  async uploadMediaStatus(
    is_long_video: boolean,
    media_id: string
  ): Promise<[any, Response]> {
    const params = {
      command: 'STATUS',
      media_id
    };

    return await this.uploadMediaWithType(
      'GET',
      is_long_video,
      {
        params,
        headers: this._base_headers
      }
    );
  }

  async createMediaMetadata(
    media_id: string,
    alt_text: string | null,
    sensitive_warning: string[] | null
  ): Promise<[any, Response]> {
    const data: Record<string, any> = { media_id };
    if (alt_text) data.alt_text = { text: alt_text };
    if (sensitive_warning) data.sensitive_media_warning = sensitive_warning;

    return await this.post(
      'https://api.x.com/1.1/media/metadata/create.json',
      {
        json: data,
        headers: this._base_headers
      }
    );
  }

  async createCard(choices: string[], duration_minutes: number): Promise<[any, Response]> {
    const card_data: CardData = {
      'twitter:card': `poll${choices.length}choice_text_only`,
      'twitter:api:api:endpoint': '1',
      'twitter:long:duration_minutes': duration_minutes
    };

    choices.forEach((choice, i) => {
      card_data[`twitter:string:choice${i + 1}_label`] = choice;
    });

    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.post(
      'https://caps.x.com/v2/cards/create.json',
      {
        data: { card_data: JSON.stringify(card_data) },
        headers
      }
    );
  }

  async vote(
    selected_choice: string,
    card_uri: string,
    tweet_id: string,
    card_name: string
  ): Promise<[any, Response]> {
    const data = {
      'twitter:string:card_uri': card_uri,
      'twitter:long:original_tweet_id': tweet_id,
      'twitter:string:response_card_name': card_name,
      'twitter:string:cards_platform': 'Web-12',
      'twitter:string:selected_choice': selected_choice
    };

    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.post(
      'https://caps.x.com/v2/capi/passthrough/1',
      { data, headers }
    );
  }

  async reverseGeocode(
    lat: number,
    long: number,
    accuracy: string | number | null,
    granularity: string | null,
    max_results: number | null
  ): Promise<[any, Response]> {
    const params: Record<string, any> = {
      lat,
      long,
      accuracy,
      granularity,
      max_results
    };

    Object.keys(params).forEach(key => {
      if (params[key] === null) delete params[key];
    });

    return await this.get(
      'https://api.x.com/1.1/geo/reverse_geocode.json',
      {
        params,
        headers: this._base_headers
      }
    );
  }

  async searchGeo(
    lat: number | null,
    long: number | null,
    query: string | null,
    ip: string | null,
    granularity: string | null,
    max_results: number | null
  ): Promise<[any, Response]> {
    const params: Record<string, any> = {
      lat,
      long,
      query,
      ip,
      granularity,
      max_results
    };

    Object.keys(params).forEach(key => {
      if (params[key] === null) delete params[key];
    });

    return await this.get(
      'https://api.x.com/1.1/geo/search.json',
      {
        params,
        headers: this._base_headers
      }
    );
  }

  async getPlace(id: string): Promise<[any, Response]> {
    return await this.get(
      `https://api.x.com/1.1/geo/id/${id}.json`,
      { headers: this._base_headers }
    );
  }

  async createFriendships(user_id: string): Promise<[any, Response]> {
    const data = {
      include_profile_interstitial_type: 1,
      include_blocking: 1,
      include_blocked_by: 1,
      include_followed_by: 1,
      include_want_retweets: 1,
      include_mute_edge: 1,
      include_can_dm: 1,
      include_can_media_tag: 1,
      include_ext_is_blue_verified: 1,
      include_ext_verified_type: 1,
      include_ext_profile_image_shape: 1,
      skip_status: 1,
      user_id
    };

    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.post(
      'https://x.com/i/api/1.1/friendships/create.json',
      { data, headers }
    );
  }

  async destroyFriendships(user_id: string): Promise<[any, Response]> {
    const data = {
      include_profile_interstitial_type: 1,
      include_blocking: 1,
      include_blocked_by: 1,
      include_followed_by: 1,
      include_want_retweets: 1,
      include_mute_edge: 1,
      include_can_dm: 1,
      include_can_media_tag: 1,
      include_ext_is_blue_verified: 1,
      include_ext_verified_type: 1,
      include_ext_profile_image_shape: 1,
      skip_status: 1,
      user_id
    };

    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.post(
      'https://x.com/i/api/1.1/friendships/destroy.json',
      { data, headers }
    );
  }

  async createBlocks(user_id: string): Promise<[any, Response]> {
    const data = { user_id };
    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.post(
      'https://x.com/i/api/1.1/blocks/create.json',
      { data, headers }
    );
  }

  async destroyBlocks(user_id: string): Promise<[any, Response]> {
    const data = { user_id };
    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.post(
      'https://x.com/i/api/1.1/blocks/destroy.json',
      { data, headers }
    );
  }

  async createMutes(user_id: string): Promise<[any, Response]> {
    const data = { user_id };
    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.post(
      'https://x.com/i/api/1.1/mutes/users/create.json',
      { data, headers }
    );
  }

  async destroyMutes(user_id: string): Promise<[any, Response]> {
    const data = { user_id };
    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.post(
      'https://x.com/i/api/1.1/mutes/users/destroy.json',
      { data, headers }
    );
  }

  async guide(
    category: string,
    count: number,
    additional_request_params: Record<string, any> | null
  ): Promise<[any, Response]> {
    const params: Record<string, any> = {
      count,
      include_page_configuration: true,
      initial_tab_id: category
    };

    if (additional_request_params) {
      Object.assign(params, additional_request_params);
    }

    return await this.get(
      'https://x.com/i/api/2/guide.json',
      {
        params,
        headers: this._base_headers
      }
    );
  }

  async availableTrends(): Promise<[any, Response]> {
    return await this.get(
      'https://api.x.com/1.1/trends/available.json',
      { headers: this._base_headers }
    );
  }

  async placeTrends(woeid: number): Promise<[any, Response]> {
    return await this.get(
      'https://api.x.com/1.1/trends/place.json',
      {
        params: { id: woeid },
        headers: this._base_headers
      }
    );
  }

  private async _friendships(
    user_id: string | null,
    screen_name: string | null,
    count: number,
    endpoint: string,
    cursor: string | null
  ): Promise<[any, Response]> {
    const params: Record<string, any> = { count };
    if (user_id) params.user_id = user_id;
    else if (screen_name) params.screen_name = screen_name;
    if (cursor) params.cursor = cursor;

    return await this.get(
      endpoint,
      {
        params,
        headers: this._base_headers
      }
    );
  }

  async followersList(
    user_id: string | null,
    screen_name: string | null,
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._friendships(
      user_id,
      screen_name,
      count,
      'https://api.x.com/1.1/followers/list.json',
      cursor
    );
  }

  async friendsList(
    user_id: string | null,
    screen_name: string | null,
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._friendships(
      user_id,
      screen_name,
      count,
      'https://api.x.com/1.1/friends/list.json',
      cursor
    );
  }

  async followersIds(
    user_id: string | null,
    screen_name: string | null,
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._friendships(
      user_id,
      screen_name,
      count,
      'https://api.x.com/1.1/followers/ids.json',
      cursor
    );
  }

  async friendsIds(
    user_id: string | null,
    screen_name: string | null,
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._friendships(
      user_id,
      screen_name,
      count,
      'https://api.x.com/1.1/friends/ids.json',
      cursor
    );
  }

  async dmNew(
    conversation_id: string,
    text: string,
    media_id: string | null = null,
    reply_to: string | null = null
  ): Promise<[any, Response]> {
    const data = {
      cards_platform: 'Web-12',
      conversation_id,
      dm_users: false,
      include_cards: 1,
      include_quote_count: true,
      recipient_ids: false,
      text,
      ...(media_id && { media_id }),
      ...(reply_to && { reply_to_dm_id: reply_to })
    };

    return await this.post(
      'https://x.com/i/api/1.1/dm/new2.json',
      {
        json: data,
        headers: this._base_headers
      }
    );
  }

  async dmConversation(
    conversation_id: string,
    max_id: string | null = null
  ): Promise<[any, Response]> {
    const params = {
      context: 'FETCH_DM_CONVERSATION_HISTORY',
      include_conversation_info: true,
      ...(max_id && { max_id })
    };

    return await this.get(
      `https://x.com/i/api/1.1/dm/conversation/${conversation_id}.json`,
      {
        params,
        headers: this._base_headers
      }
    );
  }

  async conversationUpdateName(
    group_id: string,
    name: string
  ): Promise<[any, Response]> {
    const data = { name };
    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.post(
      `https://x.com/i/api/1.1/dm/conversation/${group_id}/update_name.json`,
      { data, headers }
    );
  }

  private async _notifications(
    endpoint: string,
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    const params = {
      count,
      ...(cursor && { cursor })
    };

    return await this.get(
      endpoint,
      {
        params,
        headers: this._base_headers
      }
    );
  }

  async notificationsAll(
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._notifications(
      'https://x.com/i/api/2/notifications/all.json',
      count,
      cursor
    );
  }

  async notificationsVerified(
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._notifications(
      'https://x.com/i/api/2/notifications/verified.json',
      count,
      cursor
    );
  }

  async notificationsMentions(
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._notifications(
      'https://x.com/i/api/2/notifications/mentions.json',
      count,
      cursor
    );
  }

  async livePipelineUpdateSubscriptions(
    session: string,
    subscribe: string[],
    unsubscribe: string[]
  ): Promise<[any, Response]> {
    const data = {
      sub_topics: subscribe,
      unsub_topics: unsubscribe
    };

    const headers = {
      ...this._base_headers,
      'content-type': 'application/x-www-form-urlencoded',
      'LivePipeline-Session': session
    };

    return await this.post(
      'https://api.x.com/1.1/live_pipeline/update_subscriptions',
      { data, headers }
    );
  }

  async accountLogout(): Promise<[any, Response]> {
    return await this.post(
      'https://api.x.com/1.1/account/logout.json',
      { headers: this._base_headers }
    );
  }

  async settings(): Promise<[any, Response]> {
    return await this.get(
      'https://api.x.com/1.1/account/settings.json',
      { headers: this._base_headers }
    );
  }

  async userState(): Promise<[any, Response]> {
    return await this.get(
      'https://api.x.com/help-center/forms/api/prod/user_state.json',
      { headers: this._base_headers }
    );
  }
}

(async () => {
  const language = "en-US"
  const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const http = new FetchClient();
  const clientTransaction = new ClientTransaction();

  if (!clientTransaction.homePageResponse) {
    const ctHeaders = {
      "Accept-Language": `${language},${language.split("-")[0]};q=0.9`,
      "Cache-Control": "no-cache",
      "Referer": "https://x.com",
      "User-Agent": userAgent
    };
    await clientTransaction.init(http, ctHeaders);
  };

  const tid = await clientTransaction.generateTransactionId("GET", new URL("https://twitter.com/i/js_inst?c_name=ui_metrics").pathname);
  console.log(tid);
})();

//npx tsx ./src/client