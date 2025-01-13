import ClientTransaction from "./x_client_transaction/transaction";
import FetchClient from "./fetch_client";

const TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"

class Client {
  private language: string;
  private proxy: string | null;
  private captchaSolver: Capsolver | null;
  private userAgent: string;
  private http: FetchClient;
  private clientTransaction: ClientTransaction;
  private _token: string;
  private _userId: string | null = null;
  private _actAs: string | null = null;
  private gql: GQLClient;
  private v11: V11Client;

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
    this.userAgent = userAgent || "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

    if (this.captchaSolver) {
      this.captchaSolver.client = this;
    }

    this.http = new FetchClient();
    this.clientTransaction = new ClientTransaction();
    this._token = TOKEN;

    this.gql = new GQLClient(this);
    this.v11 = new V11Client(this);
  }

  async request(
    method: string,
    url: string,
    autoUnlock: boolean = true,
    raiseException: boolean = true,
    options: Record<string, any> = {}
  ): Promise<[Record<string, any> | unknown, Response]> {
    const headers = options.headers || {};

    if (!this.clientTransaction.homePageResponse) {
      const cookiesBackup = { ...this.getCookies() };
      const ctHeaders = {
        "Accept-Language": `${this.language},${this.language.split("-")[0]};q=0.9`,
        "Cache-Control": "no-cache",
        "Referer": "https://x.com",
        "User-Agent": this.userAgent
      };
      await this.clientTransaction.init(this.http, ctHeaders);
      this.setCookies(cookiesBackup, true);
    }

    const tid = this.clientTransaction.generateTransactionId(method, new URL(url).pathname);
    headers["X-Client-Transaction-Id"] = tid;

    const cookiesBackup = { ...this.getCookies() };
    const response: any = await this.http.request(method, url, { ...options, headers });
    this.removeDuplicateCt0Cookie();

    let responseData;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    if (responseData && typeof responseData === "object" && "errors" in responseData) {
      const errorCode = responseData.errors[0]?.code;
      const errorMessage = responseData.errors[0]?.message;
      if (errorCode === 37 || errorCode === 64) {
        throw new Error(`Account Suspended: ${errorMessage}`);
      }

      if (errorCode === 326) {
        if (!this.captchaSolver) {
          throw new Error("Account Locked: Visit https://x.com/account/access to unlock it.");
        }
        if (autoUnlock) {
          await this.unlock();
          this.setCookies(cookiesBackup, true);
          const retryResponse: any = await this.http.request(method, url, options);
          this.removeDuplicateCt0Cookie();
          try {
            responseData = await retryResponse.json();
          } catch {
            responseData = await retryResponse.text();
          }
        }
      }
    }

    const statusCode = response.status;

    if (statusCode >= 400 && raiseException) {
      new Error(`HTTP Error: Status ${statusCode}, Message: "${await response.text()}"`)
    }

    if (statusCode === 200) {
      return [responseData, response];
    }

    return [responseData, response];
  }

  private removeDuplicateCt0Cookie(): void {
    const cookieArray = Array.from(this.http.cookies.entries());
    for (const [name, value] of cookieArray) {
      if (name === "ct0" && this.http.cookies.has("ct0")) {
        continue;
      }
      this.http.cookies.set(name, value);
    }
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
      params: { flow_name: "login" },
      data: {
        input_flow_data: {
          flow_context: {
            debug_overrides: {},
            start_location: {
              location: "splash_screen"
            }
          }
        },
        subtask_versions: {
          action_list: 2,
          alert_dialog: 1,
          app_download_cta: 1,
          check_logged_in_account: 1,
          choice_selection: 3,
          contacts_live_sync_permission_prompt: 0,
          cta: 7,
          email_verification: 2,
          end_flow: 1,
          enter_date: 1,
          enter_email: 2,
          enter_password: 5,
          enter_phone: 2,
          enter_recaptcha: 1,
          enter_text: 5,
          enter_username: 2,
          generic_urt: 3,
          in_app_notification: 1,
          interest_picker: 3,
          js_instrumentation: 1,
          menu_dialog: 1,
          notifications_permission_prompt: 2,
          open_account: 2,
          open_home_timeline: 1,
          open_link: 1,
          phone_verification: 4,
          privacy_options: 1,
          security_key: 3,
          select_avatar: 4,
          select_banner: 2,
          settings_list: 7,
          show_code: 1,
          sign_up: 2,
          sign_up_review: 4,
          tweet_selection_urt: 1,
          update_users: 1,
          upload_media: 1,
          user_recommendations_list: 4,
          user_recommendations_urt: 1,
          wait_spinner: 3,
          web_modal: 1
        }
      }
    });

    await flow.ssoInit("apple");
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

    if (flow.taskId === "LoginEnterAlternateIdentifierSubtask") {
      await flow.executeTask({
        subtask_id: "LoginEnterAlternateIdentifierSubtask",
        enter_text: {
          text: authInfo2,
          link: "next_link"
        }
      });
    }

    if (flow.taskId === "DenyLoginSubtask") {
      throw new Error(flow.response.subtasks[0].cta.secondary_text.text);
    }

    await flow.executeTask({
      subtask_id: "LoginEnterPassword",
      enter_password: {
        password,
        link: "next_link"
      }
    });

    if (flow.taskId === "DenyLoginSubtask") {
      throw new Error(flow.response.subtasks[0].cta.secondary_text.text);
    }

    if (flow.taskId === "LoginAcid") {
      console.log(flow.response.subtasks[0].cta.secondary_text.text);

      await flow.executeTask({
        subtask_id: "LoginAcid",
        enter_text: {
          text: prompt(">>> "),
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

    if (!flow.response.subtasks) {
      return;
    }

    this._userId = flow.response.subtasks.find((task: any) => task.id_str)?.id_str || null;

    if (flow.taskId === "LoginTwoFactorAuthChallenge") {
      let totpCode;
      if (!totpSecret) {
        console.log(flow.response.subtasks[0].cta.secondary_text.text);
        totpCode = prompt(">>> ");
      } else {
        totpCode = new TOTP(totpSecret).generate();
      }

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

  private async _getGuestToken(): Promise<string> {
    const response = await this.v11.guestActivate();
    return response.guest_token;
  }

  private async _uiMetrics(): Promise<string> {
    const js: any = await this.http.request("GET", `https://twitter.com/i/js_inst?c_name=ui_metrics`);
    const match = js.data.match(/return ({[\s\S]*?});/);
    return match ? match[1] : "";
  }

  private getCookies(): Map<string, string> {
    return new Map(this.http.cookies);
  }

  private setCookies(cookies: Map<string, string>, clearCookies: boolean = false): void {
    if (clearCookies) {
      this.http.cookies = new Map();
    }

    const cookieArray = Array.from(cookies.entries());
    for (let i = 0; i < cookieArray.length; i++) {
      const [name, value] = cookieArray[i];
      this.http.cookies.set(name, value);
    }
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

//npx tsx ./src\client\client.ts