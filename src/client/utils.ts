import { Client } from "./index";

interface FlowResponse {
  flow_token?: string;
  subtasks: Array<{
    subtask_id: string;
    cta?: {
      secondary_text: {
        text: string;
      };
    };
    id_str?: string;
  }>;
}

export class Flow {
  private client: Client;
  private guestToken: string;
  public response: FlowResponse | null;

  constructor(client: Client, guestToken: string) {
    this.client = client;
    this.guestToken = guestToken;
    this.response = null;
  }

  async executeTask(...subtask_inputs: any[]): Promise<void> {
    const [response] = await this.client.onboardingTask(
      this.guestToken,
      this.token,
      subtask_inputs
    );
    this.response = response;
  }

  async ssoInit(provider: string): Promise<void> {
    const ssoInit = this.client.ssoInit;
    if (typeof ssoInit === "function") {
      await ssoInit(provider, this.guestToken);
    } else {
      throw new Error("SSO initialization is not supported by this client");
    }
  }

  get token(): string | null {
    if (this.response === null) {
      return null;
    }
    return this.response.flow_token ?? null;
  }

  get taskId(): string | null {
    if (this.response === null) {
      return null;
    }
    if (this.response.subtasks.length <= 0) {
      return null;
    }
    return this.response.subtasks[0].subtask_id;
  }
}