export interface User {
  id: string;
  email: string;
  token: string;
}

export interface Bot {
  id: string;
  auth_key: string;
  status: 'offline' | 'online' | 'authenticating';
  wxid?: string;
  nickname?: string;
  avatar_url?: string;
  created_at: string;
  last_active_at?: string;
  user_id?: string;
}

export interface BotProfile {
  id: string;
  bot_id: string;
  username: string;
  nickname: string;
  bind_uin: number;
  bind_email: string;
  bind_mobile: string;
  sex: number;
  level: number;
  experience: number;
  alias: string;
  big_head_img_url: string;
  small_head_img_url: string;
  updated_at: string;
}

export interface QrCodeResponse {
  Code: number;
  Data: {
    QrCodeUrl: string;
    Txt: string;
    baseResp: {
      ret: number;
      errMsg: object;
    };
  };
  Text: string;
}

export interface LoginStatusResponse {
  Code: number;
  Data: {
    uuid: string;
    state: number;
    wxid: string;
    wxnewpass: string;
    head_img_url: string;
    push_login_url_expired_time: number;
    nick_name: string;
    effective_time: number;
    unknow: number;
    device: string;
    ret: number;
    othersInServerLogin: boolean;
    tarGetServerIp: string;
    uuId: string;
    msg: string;
  };
  Text: string;
}

export interface AuthKeyResponse {
  Code: number;
  Data: string[];
  Text: string;
}

export interface KeywordReply {
  id: string;
  user_id: string;
  keyword: string;
  reply: string;
  reply_type: 'text' | 'image' | 'voice';
  match_type: 'exact' | 'fuzzy' | 'regex';
  scope: 'all' | 'private' | 'group';
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserProfileResponse {
  Code: number;
  Data: {
    baseResponse: {
      ret: number;
      errMsg: object;
    };
    userInfo: {
      userName: {
        str: string;
      };
      nickName: {
        str: string;
      };
      bindUin: number;
      bindEmail: {
        str: string;
      };
      bindMobile: {
        str: string;
      };
      sex: number;
      level: number;
      experience: number;
      alias: string;
    };
    userInfoExt: {
      bigHeadImgUrl: string;
      smallHeadImgUrl: string;
    };
  };
  Text: string;
}