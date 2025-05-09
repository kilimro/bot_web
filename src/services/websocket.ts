import mitt, { Emitter } from 'mitt';
import { supabase } from '../lib/supabase';
import { sendTextMessage, sendImageMessage, sendVoiceMessage, callAiModel } from './api';

// 配置
const WS_BASE_URL = 'wss://855部署的地址';

interface WsConnection {
  ws: WebSocket;
  heartbeatInterval: number;
  lastPongTime: number;
  reconnectTimeout?: number;
}

interface Events {
  message: {
    id: number;
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
    time: string;
    details?: string;
  };
  status: {
    type: 'success' | 'warning' | 'error';
    message: string;
  };
}

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  dataType?: 'json' | 'text';
  referer?: string;
  userAgent?: string;
}

class WebSocketService {
  private connections: Map<string, WsConnection> = new Map();
  private emitter: Emitter<Events>;
  private maxRetries = 5;
  private retryDelays = [1000, 2000, 5000, 10000, 30000];
  private retryAttempts: Map<string, number> = new Map();

  constructor() {
    this.emitter = mitt<Events>();
  }

  // 添加通用请求方法
  private async makeRequest(options: RequestOptions): Promise<any> {
    const {
      url,
      method = 'GET',
      headers = {},
      data,
      timeout = 30000,
      dataType = 'json',
      referer,
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const defaultHeaders = {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip,deflate',
        'Accept-Language': 'zh-CN,zh;q=0.8',
        'Connection': 'close',
        'User-Agent': userAgent,
        ...(referer ? { 'Referer': referer } : {}),
        ...headers
      };

      const requestOptions: RequestInit = {
        method,
        headers: defaultHeaders,
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      };

      if (data) {
        requestOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
      }

      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (dataType === 'json') {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      console.error('Request error:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('请求超时，请稍后重试');
        }
        if (error.message.includes('Failed to fetch')) {
          throw new Error('请求失败，请检查网络连接');
        }
      }
      throw error;
    }
  }

  connect(authKey: string, botId: string) {
    if (!authKey || !botId) return;

    this.checkBotStatus(botId).then(isOnline => {
      if (!isOnline) {
        console.log(`Bot ${botId} is not online, skipping connection`);
        return;
      }
      
      this.establishConnection(authKey, botId);
    });
  }

  private async checkBotStatus(botId: string): Promise<boolean> {
    try {
      const { data: bot } = await supabase
        .from('bots')
        .select('status')
        .eq('id', botId)
        .single();

      return bot?.status === 'online';
    } catch (error) {
      console.error(`Failed to check bot status: ${botId}`, error);
      return false;
    }
  }

  private establishConnection(authKey: string, botId: string) {
    this.disconnect(botId);

    const retryCount = this.retryAttempts.get(botId) || 0;
    if (retryCount >= this.maxRetries) {
      this.emitter.emit('status', {
        type: 'error',
        message: '连接失败次数过多，请检查网络或重新登录'
      });
      return;
    }

    try {
      const ws = new WebSocket(`${WS_BASE_URL}/ws/GetSyncMsg?key=${authKey}`);
      
      const connection: WsConnection = {
        ws,
        heartbeatInterval: 0,
        lastPongTime: Date.now()
      };
      
      this.connections.set(botId, connection);

      ws.onopen = () => {
        console.log(`WebSocket connected for bot ${botId}`);
        this.retryAttempts.delete(botId);
        
        connection.heartbeatInterval = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
            
            if (Date.now() - connection.lastPongTime > 30000) {
              console.log(`No pong received for bot ${botId} in 30s, reconnecting...`);
              this.reconnect(botId, authKey);
            }
          }
        }, 15000);

        this.emitter.emit('status', { 
          type: 'success', 
          message: '连接成功' 
        });
      };

      ws.onmessage = async (event) => {
        if (event.data === 'pong') {
          connection.lastPongTime = Date.now();
          return;
        }

        try {
          const message = JSON.parse(event.data);
          
          const fromUser = message.from_user_name?.str || '';
          const isGroupMessage = fromUser.includes('@chatroom');
          const rawContent = message.content?.str || '';
          let content = '';
          
          if (isGroupMessage && rawContent.includes(':')) {
            const match = rawContent.match(/^([^:]+):\s*(.*)$/s);
            if (match) {
              content = match[2].trim();
            } else {
              content = rawContent;
            }
          } else {
            content = rawContent;
          }

          console.log('Received message:', {
            from: isGroupMessage ? `${fromUser} (${fromUser.split('@')[0]})` : fromUser,
            content: content,
            type: message.msg_type
          });

          this.emitter.emit('message', {
            id: Date.now(),
            type: 'info',
            message: `收到${isGroupMessage ? '群' : '私聊'}消息: ${content}`,
            time: new Date().toLocaleString(),
            details: JSON.stringify(message, null, 2)
          });

          await this.handleMessage({
            ...message,
            parsed_sender: fromUser.split('@')[0],
            parsed_content: content
          }, botId, authKey);
        } catch (error) {
          console.error('Failed to handle message:', error);
          this.emitter.emit('message', {
            id: Date.now(),
            type: 'error',
            message: '消息处理失败',
            time: new Date().toLocaleString(),
            details: error instanceof Error ? error.message : '未知错误'
          });
        }
      };

      ws.onclose = () => {
        console.log(`WebSocket closed for bot ${botId}`);
        this.cleanup(botId);
        this.reconnect(botId, authKey);
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for bot ${botId}:`, error);
        this.emitter.emit('status', {
          type: 'error',
          message: '连接发生错误'
        });
      };
    } catch (error) {
      console.error(`Failed to create WebSocket for bot ${botId}:`, error);
      this.emitter.emit('status', {
        type: 'error',
        message: '创建连接失败'
      });
      this.reconnect(botId, authKey);
    }
  }

  private reconnect(botId: string, authKey: string) {
    const connection = this.connections.get(botId);
    if (!connection) return;

    this.checkBotStatus(botId).then(isOnline => {
      if (!isOnline) {
        console.log(`Bot ${botId} is offline, stopping reconnection attempts`);
        this.cleanup(botId);
        return;
      }

      const currentRetries = this.retryAttempts.get(botId) || 0;
      const delay = this.retryDelays[currentRetries] || 30000;
      
      this.retryAttempts.set(botId, currentRetries + 1);
      
      this.emitter.emit('status', {
        type: 'warning',
        message: `连接已断开，${delay/1000}秒后重连...`
      });

      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout);
      }

      connection.reconnectTimeout = window.setTimeout(() => {
        if (this.connections.has(botId)) {
          this.connect(authKey, botId);
        }
      }, delay);
    });
  }

  private async handleMessage(message: any, botId: string, authKey: string) {
    if (!message?.from_user_name?.str) {
      console.log('Invalid message format:', message);
      return;
    }

    const fromUser = message.from_user_name.str;
    const isGroupMessage = fromUser.includes('@chatroom');
    const content = message.parsed_content || message.content?.str || '';
    
    try {
      // 只做消息记录，不做任何自动回复、插件执行、AI回复等
      let parsedSender = '';
      let parsedContent = content;
      if (isGroupMessage) {
        const match = content.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          parsedSender = match[1];
          parsedContent = match[2];
        }
      }
      await supabase.from('bot_messages').insert([
        {
          bot_id: botId,
          msg_id: message.msg_id,
          from_user: isGroupMessage ? parsedSender || fromUser : fromUser,
          to_user: message.to_user_name.str,
          msg_type: message.msg_type,
          content: parsedContent,
          status: message.status,
          created_at: new Date(message.create_time * 1000).toISOString(),
          source: message.msg_source
        }
      ]);
      // 只分发事件用于前端展示
      this.emitter.emit('message', {
        id: Date.now(),
        type: 'info',
        message: `收到${isGroupMessage ? '群' : '私聊'}消息: ${parsedContent}`,
        time: new Date().toLocaleString(),
        details: JSON.stringify(message, null, 2)
      });
    } catch (error) {
      console.error('Error handling message:', error);
      this.emitter.emit('message', {
        id: Date.now(),
        type: 'error',
        message: '消息处理失败',
        time: new Date().toLocaleString(),
        details: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  disconnect(botId: string) {
    this.cleanup(botId);
  }

  disconnectAll() {
    for (const botId of this.connections.keys()) {
      this.disconnect(botId);
    }
  }

  on(event: keyof Events | '*', handler: any) {
    if (event === '*') {
      this.emitter.on('*', handler);
    } else {
      this.emitter.on(event, handler);
    }
  }

  removeAllListeners() {
    this.emitter.all.clear();
  }

  private cleanup(botId: string) {
    const connection = this.connections.get(botId);
    if (connection) {
      clearInterval(connection.heartbeatInterval);
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout);
      }
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
      this.connections.delete(botId);
    }
  }
}

export const wsService = new WebSocketService();