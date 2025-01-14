import { TwitterBaseHeaders } from "./client";

interface TwitterHeaders extends TwitterBaseHeaders {
  'x-guest-token'?: string;
  'Authorization'?: string;
  'X-Twitter-Active-User'?: string;
  'X-Twitter-Auth-Type'?: string;
}

interface CardData {
  'twitter:card': string;
  'twitter:api:api:endpoint': string;
  'twitter:long:duration_minutes': number;
  [key: `twitter:string:choice${number}_label`]: string;
}

interface TwitterVoteData {
  'twitter:string:card_uri': string;
  'twitter:long:original_tweet_id': string;
  'twitter:string:response_card_name': string;
  'twitter:string:cards_platform': string;
  'twitter:string:selected_choice': string;
}

interface ClientType {
  _base_headers: TwitterBaseHeaders;
  getCsrfToken(): string | null;
  post(url: string, options?: any): Promise<[any, Response]>;
  get(url: string, options?: any): Promise<[any, Response]>;
  request(method: string, url: string, ...args: any[]): Promise<[any, Response]>;
}

class Endpoint {
  static readonly GUEST_ACTIVATE = `https://api.x.com/1.1/guest/activate.json`;
  static readonly ONBOARDING_SSO_INIT = `https://api.x.com/1.1/onboarding/sso_init.json`;
  static readonly ACCOUNT_LOGOUT = `https://api.x.com/1.1/account/logout.json`;
  static readonly ONBOARDING_TASK = `https://api.x.com/1.1/onboarding/task.json`;
  static readonly SETTINGS = `https://api.x.com/1.1/account/settings.json`;
  static readonly UPLOAD_MEDIA = `https://upload.x.com/i/media/upload.json`;
  static readonly UPLOAD_MEDIA_2 = `https://upload.x.com/i/media/upload2.json`;
  static readonly CREATE_MEDIA_METADATA = `https://api.x.com/1.1/media/metadata/create.json`;
  static readonly CREATE_CARD = `https://caps.x.com/v2/cards/create.json`;
  static readonly VOTE = `https://caps.x.com/v2/capi/passthrough/1`;
  static readonly REVERSE_GEOCODE = `https://api.x.com/1.1/geo/reverse_geocode.json`;
  static readonly SEARCH_GEO = `https://api.x.com/1.1/geo/search.json`;
  static readonly GET_PLACE = `https://api.x.com/1.1/geo/id/{}.json`;
  static readonly CREATE_FRIENDSHIPS = `https://x.com/i/api/1.1/friendships/create.json`;
  static readonly DESTROY_FRIENDSHIPS = `https://x.com/i/api/1.1/friendships/destroy.json`;
  static readonly CREATE_BLOCKS = `https://x.com/i/api/1.1/blocks/create.json`;
  static readonly DESTROY_BLOCKS = `https://x.com/i/api/1.1/blocks/destroy.json`;
  static readonly CREATE_MUTES = `https://x.com/i/api/1.1/mutes/users/create.json`;
  static readonly DESTROY_MUTES = `https://x.com/i/api/1.1/mutes/users/destroy.json`;
  static readonly GUIDE = `https://x.com/i/api/2/guide.json`;
  static readonly AVAILABLE_TRENDS = `https://api.x.com/1.1/trends/available.json`;
  static readonly PLACE_TRENDS = `https://api.x.com/1.1/trends/place.json`;
  static readonly FOLLOWERS_LIST = `https://api.x.com/1.1/followers/list.json`;
  static readonly FRIENDS_LIST = `https://api.x.com/1.1/friends/list.json`;
  static readonly FOLLOWERS_IDS = `https://api.x.com/1.1/followers/ids.json`;
  static readonly FRIENDS_IDS = `https://api.x.com/1.1/friends/ids.json`;
  static readonly DM_NEW = `https://x.com/i/api/1.1/dm/new2.json`;
  static readonly DM_INBOX = `https://x.com/i/api/1.1/dm/inbox_initial_state.json`;
  static readonly DM_CONVERSATION = `https://x.com/i/api/1.1/dm/conversation/{}.json`;
  static readonly CONVERSATION_UPDATE_NAME = `https://x.com/i/api/1.1/dm/conversation/{}/update_name.json`;
  static readonly NOTIFICATIONS_ALL = `https://x.com/i/api/2/notifications/all.json`;
  static readonly NOTIFICATIONS_VERIFIED = `https://x.com/i/api/2/notifications/verified.json`;
  static readonly NOTIFICATIONS_MENTIONS = `https://x.com/i/api/2/notifications/mentions.json`;
  static readonly LIVE_PIPELINE_EVENTS = `https://api.x.com/live_pipeline/events`;
  static readonly LIVE_PIPELINE_UPDATE_SUBSCRIPTIONS = `https://api.x.com/1.1/live_pipeline/update_subscriptions`;
  static readonly USER_STATE = `https://api.x.com/help-center/forms/api/prod/user_state.json`;
}

export class V11Client {
  private base: ClientType;

  constructor(base: ClientType) {
    this.base = base;
  }

  async guestActivate(): Promise<[any, Response]> {
    const headers = { ...this.base._base_headers };
    delete headers['X-Twitter-Active-User'];
    delete headers['X-Twitter-Auth-Type'];

    return await this.base.post(
      Endpoint.GUEST_ACTIVATE,
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

    const headers: TwitterHeaders = {
      'x-guest-token': guest_token,
      'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
    };

    const csrf_token = this.base.getCsrfToken();
    if (csrf_token) {
      headers['x-csrf-token'] = csrf_token;
      headers['x-twitter-auth-type'] = 'OAuth2Session';
    }

    return await this.base.post(
      Endpoint.ONBOARDING_TASK,
      {
        json: payload,
        headers,
        ...options
      }
    );
  }

  async ssoInit(provider: string, guest_token: string): Promise<[any, Response]> {
    const headers = {
      ...this.base._base_headers,
      'x-guest-token': guest_token
    };
    delete headers['X-Twitter-Active-User'];
    delete headers['X-Twitter-Auth-Type'];

    return await this.base.post(
      Endpoint.ONBOARDING_SSO_INIT,
      {
        json: { provider },
        headers
      }
    );
  }

  async uploadMedia(
    method: string,
    is_long_video: boolean,
    options: Record<string, any> = {}
  ): Promise<[any, Response]> {
    const endpoint = is_long_video ? Endpoint.UPLOAD_MEDIA_2 : Endpoint.UPLOAD_MEDIA;
    return await this.base.request(method, endpoint, options);
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

    return await this.uploadMedia(
      'POST',
      is_long_video,
      {
        params,
        headers: this.base._base_headers
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

    const headers = { ...this.base._base_headers };
    delete headers['content-type'];

    const files = {
      media: ['blob', chunk_stream, 'application/octet-stream']
    };

    return await this.uploadMedia(
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

    return await this.uploadMedia(
      'POST',
      is_long_video,
      {
        params,
        headers: this.base._base_headers
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

    return await this.uploadMedia(
      'GET',
      is_long_video,
      {
        params,
        headers: this.base._base_headers
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

    return await this.base.post(
      Endpoint.CREATE_MEDIA_METADATA,
      {
        json: data,
        headers: this.base._base_headers
      }
    );
  }

  async createCard(choices: string[], duration_minutes: number): Promise<[any, Response]> {
    const card_data: CardData = {
      'twitter:card': `poll${choices.length}choice_text_only`,
      'twitter:api:api:endpoint': '1',
      'twitter:long:duration_minutes': duration_minutes
    } as CardData;

    choices.forEach((choice, i) => {
      card_data[`twitter:string:choice${i + 1}_label`] = choice;
    });

    const headers = {
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.base.post(
      Endpoint.CREATE_CARD,
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
    const data: TwitterVoteData = {
      'twitter:string:card_uri': card_uri,
      'twitter:long:original_tweet_id': tweet_id,
      'twitter:string:response_card_name': card_name,
      'twitter:string:cards_platform': 'Web-12',
      'twitter:string:selected_choice': selected_choice
    };

    const headers = {
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.base.post(
      Endpoint.VOTE,
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

    return await this.base.get(
      Endpoint.REVERSE_GEOCODE,
      {
        params,
        headers: this.base._base_headers
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

    return await this.base.get(
      Endpoint.SEARCH_GEO,
      {
        params,
        headers: this.base._base_headers
      }
    );
  }

  async getPlace(id: string): Promise<[any, Response]> {
    return await this.base.get(
      Endpoint.GET_PLACE.replace('{}', id),
      { headers: this.base._base_headers }
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
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.base.post(
      Endpoint.CREATE_FRIENDSHIPS,
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
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.base.post(
      Endpoint.DESTROY_FRIENDSHIPS,
      { data, headers }
    );
  }

  async createBlocks(user_id: string): Promise<[any, Response]> {
    const data = { user_id };
    const headers = {
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.base.post(
      Endpoint.CREATE_BLOCKS,
      { data, headers }
    );
  }

  async destroyBlocks(user_id: string): Promise<[any, Response]> {
    const data = { user_id };
    const headers = {
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.base.post(
      Endpoint.DESTROY_BLOCKS,
      { data, headers }
    );
  }

  async createMutes(user_id: string): Promise<[any, Response]> {
    const data = { user_id };
    const headers = {
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.base.post(
      Endpoint.CREATE_MUTES,
      { data, headers }
    );
  }

  async destroyMutes(user_id: string): Promise<[any, Response]> {
    const data = { user_id };
    const headers = {
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.base.post(
      Endpoint.DESTROY_MUTES,
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

    return await this.base.get(
      Endpoint.GUIDE,
      {
        params,
        headers: this.base._base_headers
      }
    );
  }

  async availableTrends(): Promise<[any, Response]> {
    return await this.base.get(
      Endpoint.AVAILABLE_TRENDS,
      { headers: this.base._base_headers }
    );
  }

  async placeTrends(woeid: number): Promise<[any, Response]> {
    return await this.base.get(
      Endpoint.PLACE_TRENDS,
      {
        params: { id: woeid },
        headers: this.base._base_headers
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

    return await this.base.get(
      endpoint,
      {
        params,
        headers: this.base._base_headers
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
      Endpoint.FOLLOWERS_LIST,
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
      Endpoint.FRIENDS_LIST,
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
      Endpoint.FOLLOWERS_IDS,
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
      Endpoint.FRIENDS_IDS,
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

    return await this.base.post(
      Endpoint.DM_NEW,
      {
        json: data,
        headers: this.base._base_headers
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

    return await this.base.get(
      Endpoint.DM_CONVERSATION.replace('{}', conversation_id),
      {
        params,
        headers: this.base._base_headers
      }
    );
  }

  async conversationUpdateName(
    group_id: string,
    name: string
  ): Promise<[any, Response]> {
    const data = { name };
    const headers = {
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded'
    };

    return await this.base.post(
      Endpoint.CONVERSATION_UPDATE_NAME.replace('{}', group_id),
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

    return await this.base.get(
      endpoint,
      {
        params,
        headers: this.base._base_headers
      }
    );
  }

  async notificationsAll(
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._notifications(
      Endpoint.NOTIFICATIONS_ALL,
      count,
      cursor
    );
  }

  async notificationsVerified(
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._notifications(
      Endpoint.NOTIFICATIONS_VERIFIED,
      count,
      cursor
    );
  }

  async notificationsMentions(
    count: number,
    cursor: string | null
  ): Promise<[any, Response]> {
    return await this._notifications(
      Endpoint.NOTIFICATIONS_MENTIONS,
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
      ...this.base._base_headers,
      'content-type': 'application/x-www-form-urlencoded',
      'LivePipeline-Session': session
    };

    return await this.base.post(
      Endpoint.LIVE_PIPELINE_UPDATE_SUBSCRIPTIONS,
      { data, headers }
    );
  }

  async accountLogout(): Promise<[any, Response]> {
    return await this.base.post(
      Endpoint.ACCOUNT_LOGOUT,
      { headers: this.base._base_headers }
    );
  }

  async settings(): Promise<[any, Response]> {
    return await this.base.get(
      Endpoint.SETTINGS,
      { headers: this.base._base_headers }
    );
  }

  async userState(): Promise<[any, Response]> {
    return await this.base.get(
      Endpoint.USER_STATE,
      { headers: this.base._base_headers }
    );
  }
}