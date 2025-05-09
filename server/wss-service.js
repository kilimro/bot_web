const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const express = require('express');
const http = require('http');
const cors = require('cors');
const os = require('os'); // 引入os模块
require('dotenv').config();

// 配置
const WS_BASE_URL = 'wss://855部署的地址';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = 'https://855部署的地址';
const PORT = process.env.PORT || 3031;

// 创建Express应用
const app = express();
app.use(cors()); // 允许所有跨域
const server = http.createServer(app);

// 存储日志的数组
const systemLogs = [];
const maxLogs = 30; // 最多保存1000条日志

// 自定义日志函数
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function() {
  const args = Array.from(arguments);
  const logMessage = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'info',
    message: logMessage
  };
  
  systemLogs.unshift(logEntry); // 添加到日志开头
  if (systemLogs.length > maxLogs) {
    systemLogs.pop(); // 移除最旧的日志
  }
  
  originalConsoleLog.apply(console, args);
};

console.error = function() {
  const args = Array.from(arguments);
  const logMessage = args.map(arg => 
    typeof arg === 'object' && arg instanceof Error ? arg.stack || arg.message : 
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'error',
    message: logMessage
  };
  
  systemLogs.unshift(logEntry); // 添加到日志开头
  if (systemLogs.length > maxLogs) {
    systemLogs.pop(); // 移除最旧的日志
  }
  
  originalConsoleError.apply(console, args);
};

// Express路由
app.get('/', (req, res) => {
  res.json({ code: 200, msg: '欢迎使用mianprobot' });
// ... existing code ...
});
app.get('/wss_log', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(systemLogs);
});

console.log('启动WebSocket服务...');
console.log('环境配置检查:');
console.log('- SUPABASE_URL:', SUPABASE_URL ? '已设置' : '未设置');
console.log('- SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '已设置' : '未设置');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '已设置' : '未设置');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('错误: 环境变量未正确设置，请检查.env文件');
  process.exit(1);
}

// 创建Supabase客户端（使用service_role密钥，这样就有完整的数据库访问权限）
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

class WebSocketService {
  constructor() {
    this.connections = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 10;
    this.retryDelays = [1000, 2000, 5000, 10000, 30000, 60000, 120000, 300000, 600000, 1800000];
    this.connectionLocks = new Map(); // 添加连接锁
    this.heartbeatInterval = null; // 心跳间隔
    // 添加缓存对象，减少数据库查询
    this.cache = {
      botInfo: new Map(), // 缓存机器人信息
      aiModels: new Map(), // 缓存AI模型
      keywordReplies: new Map(), // 缓存关键词回复
      plugins: new Map(), // 缓存插件
      context: new Map(), // 新增：缓存上下文消息
      cacheExpiration: 5 * 60 * 1000 // 缓存过期时间，默认5分钟
    };
    this.requestCache = new Map(); // 用于缓存重复的HTTP请求
  }

  async initialize() {
    try {
      console.log('正在初始化WebSocket服务...');
      console.log('正在连接Supabase数据库...');
      
      // 测试数据库连接并获取所有用户
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id');
        
      if (usersError) {
        console.error('获取用户列表失败:', usersError);
        throw usersError;
      }
      console.log('数据库连接成功，当前用户总数:', users?.length || 0);

      // 获取所有在线的机器人（不再按用户过滤，因为我们现在有完整的数据库访问权限）
      const { data: bots, error: botsError } = await supabase
        .from('bots')
        .select('*')
        .eq('status', 'online');

      if (botsError) {
        console.error('获取机器人列表失败:', botsError);
        throw botsError;
      }

      console.log(`找到 ${bots?.length || 0} 个在线机器人`);
      if (bots?.length > 0) {
        console.log('机器人列表:');
        bots.forEach(bot => {
          console.log(`- ID: ${bot.id}, 用户ID: ${bot.user_id}, 状态: ${bot.status}, AuthKey: ${bot.auth_key}`);
        });
      } else {
        console.log('SQL查询:', "SELECT * FROM bots WHERE status = 'online'");
        // 获取所有机器人状态分布
        const { data: allBots } = await supabase
          .from('bots')
          .select('status, user_id');
        
        const statusCount = allBots?.reduce((acc, bot) => {
          acc[bot.status] = (acc[bot.status] || 0) + 1;
          return acc;
        }, {});
        
        console.log('所有机器人状态分布:', statusCount);
        console.log('用户ID分布:', [...new Set(allBots?.map(bot => bot.user_id) || [])]);
      }

      // 为每个机器人建立连接
      for (const bot of (bots || [])) {
        console.log(`正在为机器人 ${bot.id} (用户ID: ${bot.user_id}) 建立连接...`);
        this.connect(bot.auth_key, bot.id);
      }

      // 监听数据库变化
      console.log('正在设置数据库变化监听...');
      this.subscribeToBotsChanges();
      console.log('数据库变化监听设置完成');
      
      // 启动全局心跳机制
      this.startHeartbeat();
    } catch (error) {
      console.error('初始化WebSocket服务失败:', error);
      if (error.stack) {
        console.error('错误堆栈:', error.stack);
      }
      process.exit(1);
    }
  }

  // 添加全局心跳机制
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach((connection, botId) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          try {
            connection.ws.send('ping');
            //console.log(`发送心跳到机器人 ${botId}`);
          } catch (error) {
            console.error(`发送心跳到机器人 ${botId} 失败:`, error);
            this.reconnect(botId, connection.authKey);
          }
        } else if (connection.ws.readyState !== WebSocket.CONNECTING) {
          console.log(`检测到机器人 ${botId} 连接状态异常 (${connection.ws.readyState})，尝试重连`);
          this.reconnect(botId, connection.authKey);
        }
      });
    }, 25000); // 每25秒发送一次心跳，确保连接保持活跃
    
    console.log('心跳机制已启动');
  }

  subscribeToBotsChanges() {
    const botsSubscription = supabase
      .channel('bots_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bots'
      }, async (payload) => {
        try {
          const bot = payload.new;
          
          if (payload.eventType === 'UPDATE') {
            if (bot.status === 'online' && !this.connections.has(bot.id)) {
              console.log(`机器人 ${bot.id} 上线，建立连接`);
              this.connect(bot.auth_key, bot.id);
            } else if (bot.status !== 'online' && this.connections.has(bot.id)) {
              console.log(`机器人 ${bot.id} 下线，断开连接`);
              this.disconnect(bot.id);
            }
          } else if (payload.eventType === 'DELETE' && this.connections.has(bot.id)) {
            console.log(`机器人 ${bot.id} 被删除，断开连接`);
            this.disconnect(bot.id);
          }
        } catch (error) {
          console.error('处理机器人状态变化失败:', error);
        }
      })
      .subscribe();
  }

  // 检查是否可以建立新连接
  async canEstablishConnection(botId) {
    // 如果已经有连接锁，说明正在建立连接
    if (this.connectionLocks.get(botId)) {
      console.log(`机器人 ${botId} 正在建立连接，跳过重复连接请求`);
      return false;
    }

    // 如果已经有活跃连接，先断开它
    if (this.connections.has(botId)) {
      const existingConnection = this.connections.get(botId);
      if (existingConnection.ws.readyState === WebSocket.OPEN) {
        console.log(`机器人 ${botId} 已有活跃连接，断开旧连接`);
        await this.disconnect(botId);
        // 等待一小段时间确保连接完全关闭
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return true;
  }

  async connect(authKey, botId) {
    if (!authKey || !botId) return;

    try {
      // 检查是否可以建立新连接
      if (!await this.canEstablishConnection(botId)) {
        return;
      }

      // 设置连接锁
      this.connectionLocks.set(botId, true);

      const retryCount = this.retryAttempts.get(botId) || 0;
      if (retryCount >= this.maxRetries) {
        console.error(`机器人 ${botId} 连接失败次数过多，停止重试`);
        await this.updateBotStatus(botId, 'offline');
        this.connectionLocks.delete(botId);
        return;
      }

      console.log(`正在为机器人 ${botId} 建立WebSocket连接...`);
      await this.updateBotStatus(botId, 'online'); // 只用online/offline

      // 设置连接超时
      const connectionTimeout = setTimeout(() => {
        if (this.connectionLocks.get(botId)) {
          console.log(`机器人 ${botId} 连接超时，重新尝试...`);
          this.connectionLocks.delete(botId);
          this.reconnect(botId, authKey);
        }
      }, 15000); // 15秒连接超时

      const ws = new WebSocket(`${WS_BASE_URL}/ws/GetSyncMsg?key=${authKey}`);
      const connection = {
        ws,
        reconnectTimeout: null,
        lastMessageTime: Date.now(),
        authKey,
        pendingMessages: [] // 添加消息队列以防止丢失
      };
      this.connections.set(botId, connection);

      // 定时检测假死和readyState
      if (connection.checkInterval) clearInterval(connection.checkInterval);
      connection.checkInterval = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.log(`检测到机器人 ${botId} 连接不正常 (状态: ${ws?.readyState})，重连`);
          this.reconnect(botId, authKey);
          return;
        }
        if (Date.now() - connection.lastMessageTime > 60000) { // 增加到60秒，减少误报
          console.log(`检测到机器人 ${botId} 假死，主动断开重连`);
          ws.terminate && ws.terminate();
          this.reconnect(botId, authKey);
        }
      }, 10000);

      ws.on('open', async () => {
        console.log(`机器人 ${botId} WebSocket连接成功`);
        clearTimeout(connectionTimeout);
        this.retryAttempts.delete(botId);
        this.connectionLocks.delete(botId);
        connection.lastMessageTime = Date.now();
        
        // 发送初始ping以验证连接
        try {
          ws.send('ping');
        } catch (error) {
          console.error(`向机器人 ${botId} 发送初始ping失败:`, error);
        }
        
        // 处理连接成功后的待发送消息
        if (connection.pendingMessages.length > 0) {
          console.log(`处理机器人 ${botId} 的 ${connection.pendingMessages.length} 条待发送消息`);
          for (const pendingMsg of connection.pendingMessages) {
            try {
              await this.sendMessage(
                authKey, 
                pendingMsg.toUser, 
                pendingMsg.content, 
                pendingMsg.shouldSplit, 
                pendingMsg.interval,
                pendingMsg.msgType
              );
            } catch (error) {
              console.error(`发送待处理消息失败:`, error);
            }
          }
          connection.pendingMessages = []; // 清空待发送队列
        }
      });

      ws.on('message', async (data) => {
        connection.lastMessageTime = Date.now();
        const dataStr = data.toString();
        
        if (dataStr === 'pong') {
          return;
        }
        
        // 处理服务器心跳响应
        if (dataStr === 'ping') {
          try {
            ws.send('pong');
            return;
          } catch (error) {
            console.error(`响应ping失败:`, error);
            return;
          }
        }
        
        try {
          // 记录消息处理开始时间
          const startTime = Date.now();
          
          const message = JSON.parse(dataStr);
          // 使用Promise.all并行处理消息，提高效率
          await Promise.all([
            this.handleMessage(message, botId, authKey)
          ]);
          
          // 记录消息处理总时间
          const processingTime = Date.now() - startTime;
          //console.log(`消息处理总耗时: ${processingTime}ms`);
        } catch (error) {
          console.error('处理消息失败:', error);
          if (error.stack) {
            console.error('错误堆栈:', error.stack);
          }
        }
      });

      ws.on('close', async (code, reason) => {
        clearTimeout(connectionTimeout);
        console.log(`机器人 ${botId} WebSocket连接关闭，代码: ${code}, 原因: ${reason}`);
        await this.updateBotStatus(botId, 'offline');
        this.cleanup(botId);
        this.reconnect(botId, authKey);
      });

      ws.on('error', async (error) => {
        clearTimeout(connectionTimeout);
        console.error(`机器人 ${botId} WebSocket错误:`, error);
        await this.updateBotStatus(botId, 'error');
        if (ws.readyState !== WebSocket.CLOSED) ws.terminate && ws.terminate();
        this.reconnect(botId, authKey);
      });
    } catch (error) {
      console.error(`创建机器人 ${botId} WebSocket连接失败:`, error);
      await this.updateBotStatus(botId, 'error');
      this.connectionLocks.delete(botId);
      this.reconnect(botId, authKey);
    }
  }

  async handleMessage(message, botId, authKey) {
    // 添加性能监控
    const startTime = Date.now();
    
    if (!message?.from_user_name?.str) {
      console.log('无效的消息格式:', message);
      return;
    }

    const fromUser = message.from_user_name.str;
    const isGroupMessage = fromUser.includes('@chatroom');
    let content = message.content?.str || '';
    let msgType = 'text';
    
    // 根据消息类型处理内容
    if (message.msg_type === 3) { // 图片消息
      msgType = 'image';
      content = message.image?.image_url || '';
    } else if (message.msg_type === 34) { // 语音消息
      msgType = 'voice';
      content = message.voice?.voice_url || '';
    }
    
    // 添加消息日志记录
    console.log(`收到消息 - 机器人${botId}:`);
    console.log(`- 发送者: ${fromUser}`);
    console.log(`- 消息类型: ${isGroupMessage ? '群聊' : '私聊'} (${msgType})`);
    console.log(`- 内容: ${content}`);

    try {
      // 解析群聊消息
      let parsedSender = '';
      let parsedContent = content;
      
      if (isGroupMessage && content.includes(':') && msgType === 'text') {
        const match = content.match(/^([^:]+):\s*(.*)$/s);
        if (match) {
          parsedSender = match[1];
          parsedContent = match[2].trim();
        }
      }

      // 并行执行多个操作以提高性能
      await Promise.all([
        // 1. 记录消息到数据库
        this.recordMessage(botId, message, fromUser, parsedSender, parsedContent, msgType, content),
        
        // 2. 如果是文本消息，并行处理AI回复和关键词回复
        (async () => {
          if (msgType === 'text') {
            // 首先获取必要的配置信息，减少数据库查询
            const [botInfo, aiModels, keywordReplies, plugins] = await Promise.all([
              this.getBotInfo(botId),
              this.getAIModels(botId),
              this.getKeywordReplies(botId),
              this.getPlugins(botId)
            ]);
            
            if (!botInfo) return;
            
            // 根据优先级并行处理响应
            const results = await Promise.allSettled([
              // 插件响应有最高优先级
              this.processPluginResponse(plugins, message, botId, authKey, parsedContent, fromUser, isGroupMessage),
              
              // AI回复和关键词回复可以并行处理
              this.processAIResponse(aiModels, message, botId, authKey, parsedContent, fromUser, isGroupMessage, botInfo),
              
              this.processKeywordReply(keywordReplies, message, botId, authKey, parsedContent, fromUser, isGroupMessage)
            ]);
            
            // 检查插件处理结果，如果成功就停止其他处理
            if (results[0].status === 'fulfilled' && results[0].value === true) {
              console.log(`插件成功处理了消息，跳过其他处理`);
              return;
            }
            
            // 其他处理结果可以忽略，因为它们会各自处理发送响应
          }
        })()
      ]);
      
      // 记录性能指标
      const processingTime = Date.now() - startTime;
      //console.log(`消息处理完成，耗时: ${processingTime}ms`);
      
    } catch (error) {
      console.error('处理消息失败:', error);
      const processingTime = Date.now() - startTime;
      console.error(`消息处理失败，耗时: ${processingTime}ms`);
    }
  }
  
  // 新增方法：记录消息到数据库
  async recordMessage(botId, message, fromUser, parsedSender, parsedContent, msgType, content) {
    try {
      await supabase.from('bot_messages').insert([{
        bot_id: botId,
        msg_id: message.msg_id,
        from_user: message.from_user_name.str.includes('@chatroom') ? parsedSender || fromUser : fromUser,
        to_user: message.to_user_name.str,
        msg_type: message.msg_type,
        content: parsedContent,
        media_url: msgType !== 'text' ? content : null,
        status: message.status,
        created_at: new Date(message.create_time * 1000).toISOString(),
        source: message.msg_source
      }]);
    } catch (error) {
      console.error('记录消息失败:', error);
    }
  }
  
  // 新增方法：获取机器人信息（使用缓存）
  async getBotInfo(botId) {
    // 检查缓存
    const cacheKey = `bot_${botId}`;
    const cachedInfo = this.cache.botInfo.get(cacheKey);
    if (cachedInfo && (Date.now() - cachedInfo.timestamp) < this.cache.cacheExpiration) {
      return cachedInfo.data;
    }
    
    try {
      const { data: bot, error: botError } = await supabase
        .from('bots')
        .select('user_id')
        .eq('id', botId)
        .single();
        
      if (botError) {
        console.error('获取机器人信息失败:', botError);
        return null;
      }
      
      // 更新缓存
      this.cache.botInfo.set(cacheKey, {
        data: bot,
        timestamp: Date.now()
      });
      
      return bot;
    } catch (error) {
      console.error('获取机器人信息异常:', error);
      return null;
    }
  }
  
  // 新增方法：获取AI模型配置（使用缓存）
  async getAIModels(botId) {
    try {
      // 先获取机器人信息
      const bot = await this.getBotInfo(botId);
      if (!bot?.user_id) return [];
      
      // 检查缓存
      const cacheKey = `aimodels_${bot.user_id}`;
      const cachedModels = this.cache.aiModels.get(cacheKey);
      if (cachedModels && (Date.now() - cachedModels.timestamp) < this.cache.cacheExpiration) {
        return cachedModels.data;
      }
      
      const { data: aiModels, error: modelError } = await supabase
        .from('ai_models')
        .select('*')
        .eq('user_id', bot.user_id)
        .eq('enabled', true);
        
      if (modelError) {
        console.error('获取AI模型配置失败:', modelError);
        return [];
      }
      
      // 更新缓存
      this.cache.aiModels.set(cacheKey, {
        data: aiModels || [],
        timestamp: Date.now()
      });
      
      return aiModels || [];
    } catch (error) {
      console.error('获取AI模型配置异常:', error);
      return [];
    }
  }
  
  // 新增方法：获取关键词回复配置（使用缓存）
  async getKeywordReplies(botId) {
    try {
      // 先获取机器人信息
      const bot = await this.getBotInfo(botId);
      if (!bot?.user_id) return [];
      
      // 检查缓存
      const cacheKey = `keywordreplies_${bot.user_id}`;
      const cachedReplies = this.cache.keywordReplies.get(cacheKey);
      if (cachedReplies && (Date.now() - cachedReplies.timestamp) < this.cache.cacheExpiration) {
        return cachedReplies.data;
      }
      
      const { data: replies, error } = await supabase
        .from('keyword_replies')
        .select('*')
        .eq('user_id', bot.user_id)
        .eq('is_active', true);
        
      if (error) {
        console.error('获取关键词回复配置失败:', error);
        return [];
      }
      
      // 更新缓存
      this.cache.keywordReplies.set(cacheKey, {
        data: replies || [],
        timestamp: Date.now()
      });
      
      return replies || [];
    } catch (error) {
      console.error('获取关键词回复配置异常:', error);
      return [];
    }
  }
  
  // 新增方法：获取插件配置（使用缓存）
  async getPlugins(botId) {
    try {
      // 先获取机器人信息
      const bot = await this.getBotInfo(botId);
      if (!bot?.user_id) return [];
      
      // 检查缓存
      const cacheKey = `plugins_${bot.user_id}`;
      const cachedPlugins = this.cache.plugins.get(cacheKey);
      if (cachedPlugins && (Date.now() - cachedPlugins.timestamp) < this.cache.cacheExpiration) {
        return cachedPlugins.data;
      }
      
      const { data: plugins, error } = await supabase
        .from('plugins')
        .select('*')
        .eq('user_id', bot.user_id)
        .eq('is_active', true);
        
      if (error) {
        console.error('获取插件配置失败:', error);
        return [];
      }
      
      // 更新缓存
      this.cache.plugins.set(cacheKey, {
        data: plugins || [],
        timestamp: Date.now()
      });
      
      return plugins || [];
    } catch (error) {
      console.error('获取插件配置异常:', error);
      return [];
    }
  }
  
  // 优化方法：处理AI响应
  async processAIResponse(aiModels, message, botId, authKey, content, fromUser, isGroupMessage, botInfo) {
    if (!aiModels?.length) return false;
    
    const startTime = Date.now();
    
    try {
      // 检查是否有任何AI模型的触发前缀匹配
      const matchedModel = aiModels.find(model => 
        content.toLowerCase().startsWith(model.trigger_prefix.toLowerCase()) &&
        !model.block_list.includes(fromUser) &&
        !(model.send_type === 'private' && isGroupMessage) &&
        !(model.send_type === 'group' && !isGroupMessage) &&
        !(model.send_type === 'group' && !model.group_whitelist.includes('all') && !model.group_whitelist.includes(fromUser)) &&
        Math.random() * 100 <= model.reply_probability
      );
      
      if (!matchedModel) return false;
      
      const triggerPrefix = matchedModel.trigger_prefix.toLowerCase();
      const userMessage = content.slice(triggerPrefix.length).trim();
      
      if (!userMessage) return false;
      
      console.log(`处理AI响应 - 匹配模型: ${matchedModel.name}`);
      console.log(`上下文消息数量配置: ${matchedModel.context_count}`);
      
      // 获取上下文消息 - 改进逻辑
      let context = [];
      if (matchedModel.context_count > 0) {
        console.log(`开始获取上下文消息，限制 ${matchedModel.context_count} 条`);
        
        try {
          // 使用更精确的缓存键，区分私聊和群聊
          const cacheKey = `context_${botId}_${fromUser}_${isGroupMessage ? 'group' : 'private'}`;
          const cachedContext = this.cache.context?.get(cacheKey);
          
          if (cachedContext && (Date.now() - cachedContext.timestamp) < 30000) { // 30秒内有效，缩短缓存时间确保更新及时性
            console.log(`使用缓存的上下文消息，共 ${cachedContext.data.length} 条`);
            context = [...cachedContext.data];
          } else {
            // 获取上下文消息，改进查询条件
            const historyStartTime = Date.now();
            
            // 构建查询，确保获取的是同一对话场景的消息
            let query = supabase
              .from('bot_messages')
              .select('*')
              .eq('bot_id', botId);
              
            // 修改：简化查询条件，提高上下文准确性
            if (isGroupMessage) {
              // 群聊：该群的所有消息
              query = query.eq('to_user', fromUser);
            } else {
              // 私聊：用户和机器人之间的对话
              query = query.or(`from_user.eq.${fromUser},to_user.eq.${fromUser}`);
            }
            
            // 获取最近的消息，按时间降序
            const { data: history, error } = await query
              .order('created_at', { ascending: false })
              .limit(matchedModel.context_count * 3); // 获取更多消息，避免漏掉对话
            
            console.log(`获取上下文消息查询耗时: ${Date.now() - historyStartTime}ms`);
            
            if (error) {
              console.error('获取上下文消息失败:', error);
              console.error('执行的SQL查询:', query);
            } else if (history && history.length > 0) {
              console.log(`成功获取 ${history.length} 条上下文消息`);
              console.log(`上下文消息来源:`, history.map(h => ({ from: h.from_user, to: h.to_user, content: h.content?.substring(0, 20) })));
              
              // 将消息按时间正序排列，最早的消息在前
              const sortedHistory = [...history].sort((a, b) => {
                return new Date(a.created_at) - new Date(b.created_at);
              });
              
              // 转换为AI所需的格式
              const formattedContext = [];
              let messagesCount = 0;
              
              for (const msg of sortedHistory) {
                // 只保留文本消息
                if (msg.msg_type === 1 || msg.msg_type === 0) { // 文本消息
                  // 修改：简化角色判断，如果来源是assistant，则为assistant，否则为user
                  const role = msg.from_user === 'assistant' ? 'assistant' : 'user';
                  
                  // 过滤掉触发前缀
                  let messageContent = msg.content || '';
                  if (role === 'user' && messageContent.toLowerCase().startsWith(triggerPrefix.toLowerCase())) {
                    messageContent = messageContent.slice(triggerPrefix.length).trim();
                  }
                  
                  if (messageContent) {
                    formattedContext.push({
                      role: role,
                      content: messageContent
                    });
                    messagesCount++;
                    
                    // 达到所需的上下文数量后停止
                    if (messagesCount >= matchedModel.context_count) break;
                  }
                }
              }
              
              context = formattedContext;
              
              // 缓存上下文消息
              if (!this.cache.context) {
                this.cache.context = new Map();
              }
              this.cache.context.set(cacheKey, {
                data: context,
                timestamp: Date.now()
              });
              
              // 记录上下文内容，用于调试
              console.log('上下文消息内容:');
              context.forEach((ctx, idx) => {
                console.log(`- [${idx}] ${ctx.role}: ${ctx.content.substring(0, 30)}${ctx.content.length > 30 ? '...' : ''}`);
              });
            }
          }
        } catch (contextError) {
          console.error('处理上下文消息时出错:', contextError);
          console.error('错误堆栈:', contextError.stack);
          // 错误时继续处理，但不使用上下文
          context = [];
        }
        
        console.log(`最终使用 ${context.length} 条上下文消息`);
      }

      // 处理系统提示词中的参数
      let systemPrompt = matchedModel.system_prompt;
      const now = new Date();
      const replacements = {
        '[time]': now.toLocaleString(),
        '[date]': now.toLocaleDateString(),
        '[year]': now.getFullYear().toString(),
        '[month]': (now.getMonth() + 1).toString(),
        '[day]': now.getDate().toString(),
        '[hour]': now.getHours().toString(),
        '[minute]': now.getMinutes().toString(),
        '[second]': now.getSeconds().toString(),
        '[发送人id]': fromUser,
        '[发送人昵称]': message.parsed_sender || fromUser,
        '[群号]': isGroupMessage ? fromUser : '',
        '[消息类型]': isGroupMessage ? '群聊' : '私聊',
        '[触发前缀]': matchedModel.trigger_prefix,
        '[模型名称]': matchedModel.name
      };

      Object.entries(replacements).forEach(([key, value]) => {
        systemPrompt = systemPrompt.replace(new RegExp(key, 'g'), value);
      });

      // 调用AI模型并发送响应
      console.log(`调用AI模型: ${matchedModel.model}, 消息长度: ${userMessage.length}字符, 上下文消息数: ${context.length}`);
      
      // 记录调用模型的完整上下文，帮助调试
      console.log('发送给模型的完整消息：', JSON.stringify({
        model: matchedModel.model,
        system_prompt: systemPrompt,
        context: context,  // 修改为context不是messages
        user_message: userMessage
      }, null, 2));
      
      const aiResponse = await this.callAIModel(authKey, {
        ...matchedModel,
        system_prompt: systemPrompt
      }, userMessage, context);

      if (matchedModel.enable_split_send) {
        const segments = aiResponse.split(/[。！？]/).filter(segment => segment.trim());
        for (const segment of segments) {
          await this.sendMessage(authKey, fromUser, segment.trim());
        }
      } else {
        await this.sendMessage(authKey, fromUser, aiResponse);
      }
      
      // 将用户消息也保存到数据库，确保对话连贯性
      try {
        // 首先保存用户的消息
        await supabase.from('bot_messages').insert([{
          bot_id: botId,
          msg_id: `user_message_${Date.now()}`,
          from_user: fromUser,
          to_user: fromUser.includes('@chatroom') ? botId : fromUser, // 区分群聊和私聊
          msg_type: 1, // 文本消息
          content: content, // 保留原始消息，包括触发前缀
          media_url: null,
          status: 2, // 已处理
          created_at: new Date().toISOString(),
          source: 'user_message'
        }]);
        
        // 然后保存AI的回复
        await supabase.from('bot_messages').insert([{
          bot_id: botId,
          msg_id: `ai_reply_${Date.now()}`,
          from_user: 'assistant', // 明确标记为助手
          to_user: fromUser,
          msg_type: 1, // 文本消息
          content: aiResponse,
          media_url: null,
          status: 2, // 已发送
          created_at: new Date().toISOString(),
          source: 'ai_response'
        }]);
        
        console.log('用户消息和AI回复已保存到数据库，用于上下文');
        
        // 更新上下文缓存，添加本次对话
        const cacheKey = `context_${botId}_${fromUser}_${isGroupMessage ? 'group' : 'private'}`;
        const cachedContext = this.cache.context?.get(cacheKey);
        if (cachedContext) {
          // 添加新消息到缓存
          const updatedContext = [...cachedContext.data];
          
          // 添加用户消息
          updatedContext.push({
            role: 'user',
            content: userMessage // 存储去掉前缀的用户消息
          });
          
          // 添加助手回复
          updatedContext.push({
            role: 'assistant',
            content: aiResponse
          });
          
          // 确保不超过上下文限制
          while (updatedContext.length > matchedModel.context_count) {
            updatedContext.shift();
          }
          
          // 更新缓存
          this.cache.context.set(cacheKey, {
            data: updatedContext,
            timestamp: Date.now()
          });
          
          console.log(`更新上下文缓存，现有 ${updatedContext.length} 条消息`);
          console.log('更新后的上下文消息:');
          updatedContext.forEach((ctx, idx) => {
            console.log(`- [${idx}] ${ctx.role}: ${ctx.content.substring(0, 30)}${ctx.content.length > 30 ? '...' : ''}`);
          });
        } else {
          // 如果缓存不存在，创建新的缓存
          const newContext = [
            {
              role: 'user',
              content: userMessage // 去掉前缀的用户消息
            },
            {
              role: 'assistant',
              content: aiResponse
            }
          ];
          
          if (!this.cache.context) {
            this.cache.context = new Map();
          }
          
          this.cache.context.set(cacheKey, {
            data: newContext,
            timestamp: Date.now()
          });
          
          console.log(`创建新的上下文缓存，包含 ${newContext.length} 条消息`);
        }
      } catch (saveError) {
        console.error('保存对话记录到数据库失败:', saveError);
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`AI响应处理完成，耗时: ${processingTime}ms`);
      
      return true;
    } catch (error) {
      console.error('处理AI响应失败:', error);
      const processingTime = Date.now() - startTime;
      console.error(`AI响应处理失败，耗时: ${processingTime}ms`);
      return false;
    }
  }
  
  // 新增方法：处理关键词回复
  async processKeywordReply(keywordReplies, message, botId, authKey, content, fromUser, isGroupMessage) {
    if (!keywordReplies?.length) return false;
    
    const startTime = Date.now();
    
    try {
      for (const reply of keywordReplies) {
        if (
          reply.scope !== 'all' &&
          ((reply.scope === 'private' && isGroupMessage) ||
          (reply.scope === 'group' && !isGroupMessage))
        ) {
          continue;
        }

        let isMatch = false;
        switch (reply.match_type) {
          case 'exact':
            isMatch = content === reply.keyword;
            break;
          case 'fuzzy':
            isMatch = content.toLowerCase().includes(reply.keyword.toLowerCase());
            break;
          case 'regex':
            try {
              const regex = new RegExp(reply.keyword, 'i');
              isMatch = regex.test(content);
            } catch (error) {
              console.error('无效的正则表达式:', error);
            }
            break;
        }

        if (isMatch) {
          console.log(`关键词匹配成功: ${reply.keyword}`);
          
          try {
            switch (reply.reply_type) {
              case 'text':
                await this.sendMessage(authKey, fromUser, reply.reply);
                break;
              case 'image':
                await this.sendMessage(authKey, fromUser, reply.reply, false, 0, 'image');
                break;
              case 'voice':
                await this.sendMessage(authKey, fromUser, reply.reply, false, 0, 'voice');
                break;
            }
            
            const processingTime = Date.now() - startTime;
            console.log(`关键词回复处理完成，耗时: ${processingTime}ms`);
            
            return true;
          } catch (error) {
            console.error('发送关键词回复失败:', error);
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('处理关键词回复失败:', error);
      const processingTime = Date.now() - startTime;
      console.error(`关键词回复处理失败，耗时: ${processingTime}ms`);
      return false;
    }
  }
  
  // 新增方法：处理插件响应
  async processPluginResponse(plugins, message, botId, authKey, content, fromUser, isGroupMessage) {
    if (!plugins?.length) return false;
    
    const startTime = Date.now();
    
    try {
      // 使用Promise.all并行检查所有插件的触发条件
      const pluginMatchPromises = plugins.map(async (plugin) => {
        const triggerPattern = plugin.trigger.endsWith('?') 
          ? plugin.trigger.slice(0, -1) 
          : plugin.trigger;
        
        const hasParams = plugin.trigger.endsWith('?');
        const messageContent = content.trim();
        
        let isMatch = false;
        let params = '';

        if (hasParams) {
          if (messageContent.startsWith(triggerPattern)) {
            isMatch = true;
            params = messageContent.slice(triggerPattern.length).trim();
          }
        } else {
          isMatch = messageContent === triggerPattern;
        }

        return { plugin, isMatch, params };
      });
      
      const pluginMatches = await Promise.all(pluginMatchPromises);
      
      // 找到第一个匹配的插件
      const matchedPlugin = pluginMatches.find(match => match.isMatch);
      
      if (matchedPlugin) {
        const { plugin, params } = matchedPlugin;
        
        console.log(`插件触发匹配: ${plugin.trigger}`);
        const pluginStartTime = Date.now();
        
        // 创建插件沙箱环境
        const sandbox = {
          sendText: async (text) => {
            await this.sendMessage(authKey, fromUser, String(text));
          },
          sendImage: async (url) => {
            try {
              if (/^https?:\/\//.test(url)) {
                // 为图片请求增加缓存机制
                let imageData;
                const cacheKey = `image_${url}`;
                const cachedImage = this.requestCache.get(cacheKey);
                
                if (cachedImage && (Date.now() - cachedImage.timestamp) < 60000) { // 1分钟缓存
                  imageData = cachedImage.data;
                } else {
                  console.log(`获取图片: ${url}`);
                  const imageStartTime = Date.now();
                  const response = await fetch(url);
                  const buffer = await response.arrayBuffer();
                  const base64 = Buffer.from(buffer).toString('base64');
                  imageData = `data:image/jpeg;base64,${base64}`;
                  
                  // 缓存图片数据
                  this.requestCache.set(cacheKey, {
                    data: imageData,
                    timestamp: Date.now()
                  });
                  
                  console.log(`获取图片完成，耗时: ${Date.now() - imageStartTime}ms`);
                }
                
                await this.sendMessage(authKey, fromUser, imageData, false, 0, 'image');
              } else {
                await this.sendMessage(authKey, fromUser, url, false, 0, 'image');
              }
            } catch (error) {
              console.error('发送图片失败:', error);
              await this.sendMessage(authKey, fromUser, '发送图片失败，请检查图片URL是否正确');
            }
          },
          sendVoice: async (url) => {
            await this.sendMessage(authKey, fromUser, url, false, 0, 'voice');
          },
          request: async (options) => {
            // 对request方法添加性能监控
            const requestStartTime = Date.now();
            console.log(`插件API请求: ${options.url}`);
            
            // 为GET请求增加缓存机制
            if (options.method?.toUpperCase() === 'GET' || !options.method) {
              const cacheKey = `request_${options.url}`;
              const cachedResponse = this.requestCache.get(cacheKey);
              
              if (cachedResponse && (Date.now() - cachedResponse.timestamp) < 60000) { // 1分钟缓存
                console.log(`使用缓存的API响应: ${options.url}`);
                return cachedResponse.data;
              }
            }
            
            try {
              const response = await this.makeRequest(options);
              
              // 缓存GET请求结果
              if (options.method?.toUpperCase() === 'GET' || !options.method) {
                this.requestCache.set(`request_${options.url}`, {
                  data: response,
                  timestamp: Date.now()
                });
              }
              
              console.log(`插件API请求完成，耗时: ${Date.now() - requestStartTime}ms`);
              return response;
            } catch (error) {
              console.error(`插件API请求失败:`, error);
              console.error(`插件API请求失败，耗时: ${Date.now() - requestStartTime}ms`);
              throw error;
            }
          },
          param: (index) => {
            if (!params) return '';
            const parts = params.split(/\s+/);
            return parts[index - 1] || '';
          },
          getUserId: () => message.from_user_name?.str || '',
          getChatId: () => message.to_user_name?.str || '',
          getSenderName: () => message.from_user_name?.str?.split('@')[0] || '',
          isPrivateChat: () => !message.from_user_name?.str?.includes('@chatroom'),
          isGroupChat: () => message.from_user_name?.str?.includes('@chatroom'),
          getMessageType: () => message.msg_type,
          filterEmoji: (text) => text.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, ''),
          encodeURIComponent,
          decodeURIComponent,
          formatDate: (date, format) => {
            const pad = (n) => n < 10 ? '0' + n : n;
            return format
              .replace('YYYY', String(date.getFullYear()))
              .replace('MM', pad(date.getMonth() + 1))
              .replace('DD', pad(date.getDate()))
              .replace('HH', pad(date.getHours()))
              .replace('mm', pad(date.getMinutes()))
              .replace('ss', pad(date.getSeconds()));
          },
          random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
          sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
        };

        try {
          // 执行插件代码，添加更详细的错误处理
          const fn = new Function('sandbox', `
            with (sandbox) {
              return (async () => {
                try {
                  ${plugin.code}
                  return await main();
                } catch (error) {
                  console.error("插件执行错误:", error);
                  sendText("插件执行错误: " + error.message);
                  return false;
                }
              })();
            }
          `);

          await fn(sandbox);
          
          const pluginProcessingTime = Date.now() - pluginStartTime;
          console.log(`插件代码执行完成，耗时: ${pluginProcessingTime}ms`);
          
          const totalProcessingTime = Date.now() - startTime;
          console.log(`插件响应处理完成，耗时: ${totalProcessingTime}ms`);
          
          return true;
        } catch (error) {
          console.error("插件执行失败:", error);
          await this.sendMessage(authKey, fromUser, `插件执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
          const processingTime = Date.now() - startTime;
          console.error(`插件执行失败，耗时: ${processingTime}ms`);
          return true; // 仍然返回true，表示插件已处理过，避免继续其他处理
        }
      }
      
      return false;
    } catch (error) {
      console.error('处理插件响应失败:', error);
      const processingTime = Date.now() - startTime;
      console.error(`插件响应处理失败，耗时: ${processingTime}ms`);
      return false;
    }
  }

  // 优化通用请求方法，添加重试机制
  async makeRequest(options) {
    const {
      url,
      method = 'GET',
      headers = {},
      data,
      timeout = 30000,
      dataType = 'text',
      retries = 2 // 默认重试2次
    } = options;

    if (!url) {
      throw new Error('请求URL不能为空');
    }

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const requestStartTime = Date.now();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const defaultHeaders = {
          'Accept': '*/*',
          'Accept-Encoding': 'gzip,deflate',
          'Accept-Language': 'zh-CN,zh;q=0.8',
          'Connection': 'keep-alive',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...headers
        };

        const requestOptions = {
          method: method.toUpperCase(),
          headers: defaultHeaders,
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
        
        const result = dataType === 'json' ? await response.json() : await response.text();
        
        console.log(`请求完成: ${url}, 耗时: ${Date.now() - requestStartTime}ms`);
        return result;
      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          console.error(`请求超时: ${url}, 尝试: ${attempt + 1}/${retries + 1}`);
        } else {
          console.error(`请求失败: ${url}, 尝试: ${attempt + 1}/${retries + 1}`, error);
        }
        
        // 如果已经是最后一次尝试，则直接抛出错误
        if (attempt === retries) {
          throw error;
        }
        
        // 重试前等待，使用指数退避策略
        const retryDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw lastError;
  }

  async updateBotStatus(botId, status) {
    try {
      const { error } = await supabase
        .from('bots')
        .update({ 
          status,
          last_active_at: new Date().toISOString()
        })
        .eq('id', botId);

      if (error) throw error;
    } catch (error) {
      console.error('更新机器人状态失败:', error);
    }
  }

  reconnect(botId, authKey) {
    // 防止并发重连
    if (this.connectionLocks.get(botId)) {
      console.log(`机器人 ${botId} 正在重连中，跳过重复重连请求`);
      return;
    }
    const currentRetries = this.retryAttempts.get(botId) || 0;
    if (currentRetries >= this.maxRetries) {
      console.log(`机器人 ${botId} 达到最大重试次数，停止重连`);
      return;
    }
    const delay = this.retryDelays[currentRetries] || 30000;
    this.retryAttempts.set(botId, currentRetries + 1);
    console.log(`机器人 ${botId} 将在 ${delay/1000} 秒后重连... (第 ${currentRetries + 1} 次重试)`);
    if (this.connections.has(botId)) {
      const connection = this.connections.get(botId);
      if (connection.reconnectTimeout) clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = setTimeout(() => {
        this.connect(authKey, botId);
      }, delay);
    } else {
      setTimeout(() => {
        this.connect(authKey, botId);
      }, delay);
    }
  }

  disconnect(botId) {
    console.log(`正在断开机器人 ${botId} 的连接...`);
    this.cleanup(botId);
    this.connectionLocks.delete(botId); // 确保释放连接锁
  }

  cleanup(botId) {
    const connection = this.connections.get(botId);
    if (connection) {
      clearInterval(connection.checkInterval);
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout);
      }
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
      this.connections.delete(botId);
    }
  }

  async sendMessage(authKey, toUser, content, shouldSplit = false, interval = 1000, msgType = 'text') {
    try {
      console.log(`发送${msgType}消息到 ${toUser}`);
      console.log(`- 内容: ${content}`);
      
      // 获取botId
      let botId = null;
      for (const [id, connection] of this.connections.entries()) {
        if (connection.authKey === authKey) {
          botId = id;
          break;
        }
      }
      
      // 检查连接状态
      if (botId && this.connections.has(botId)) {
        const connection = this.connections.get(botId);
        
        // 如果连接不可用，添加到待发送队列
        if (connection.ws.readyState !== WebSocket.OPEN) {
          console.log(`机器人 ${botId} 连接未就绪，消息添加到待发送队列`);
          connection.pendingMessages.push({
            toUser,
            content,
            shouldSplit,
            interval,
            msgType
          });
          return;
        }
      }
      
      if (msgType === 'text') {
        if (shouldSplit) {
          const segments = content.split(/[。！？]/).filter(segment => segment.trim());
          for (const segment of segments) {
            await this.sendRequest('/message/SendTextMessage', authKey, {
              MsgItem: [{
                AtWxIDList: [],
                ImageContent: "",
                MsgType: 0,
                TextContent: segment.trim(),
                ToUserName: toUser
              }]
            });
          }
        } else {
          await this.sendRequest('/message/SendTextMessage', authKey, {
            MsgItem: [{
              AtWxIDList: [],
              ImageContent: "",
              MsgType: 0,
              TextContent: content,
              ToUserName: toUser
            }]
          });
        }
      } else if (msgType === 'image') {
        await this.sendRequest('/message/SendImageNewMessage', authKey, {
          MsgItem: [{
            AtWxIDList: [],
            ImageContent: content, // content here is the image URL or base64
            MsgType: 0,
            TextContent: "",
            ToUserName: toUser
          }]
        });
      } else if (msgType === 'voice') {
        await this.sendRequest('/message/SendVoice', authKey, {
          ToUserName: toUser,
          VoiceData: content, // content here is the voice URL
          VoiceFormat: 0,
          VoiceSecond: 0
        });
      }
    } catch (error) {
      console.error(`发送消息失败: ${error.message}`);
      throw error;
    }
  }

  async sendRequest(endpoint, authKey, data) {
    try {
      const baseUrl = API_BASE_URL;
      const url = `${baseUrl}${endpoint}?key=${authKey}`;
      
      // 添加请求超时设置
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      // 修改请求头，使其与Postman一致
      const response = await axios.post(url, data, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'PostmanRuntime/7.36.0',  // 修改为Postman的User-Agent
          'Connection': 'keep-alive'
        },
        signal: controller.signal,
        timeout: 30000, // 设置axios自身的超时
        // 禁用自动添加的请求头
        decompress: true
      });
      
      clearTimeout(timeoutId);
      console.log(`API请求成功: ${endpoint}`);
      return response.data;
    } catch (error) {
      // 增强错误处理
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        console.error(`API请求超时: ${endpoint}`);
        throw new Error('请求超时');
      }
      
      if (error.response) {
        // 服务器返回了错误响应
        console.error(`API请求失败 (${error.response.status}): ${endpoint}`);
        console.error('请求数据:', JSON.stringify(data));
        console.error('响应数据:', error.response.data);
        console.error('请求头:', JSON.stringify(error.config.headers));
        
        if (error.response.status === 403) {
          // 特别处理403错误，尝试重新请求一次
          try {
            console.log(`收到403错误，尝试使用备用请求头重新请求`);
            const retryResponse = await axios.post(url, data, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
                'Connection': 'keep-alive'
              },
              timeout: 30000
            });
            console.log(`重试请求成功: ${endpoint}`);
            return retryResponse.data;
          } catch (retryError) {
            console.error(`重试请求仍然失败:`, retryError.message);
            throw new Error(`API请求失败: ${error.response.status} ${error.response.statusText}`);
          }
        }
        
        throw new Error(`API请求失败: ${error.response.status} ${error.response.statusText}`);
      }
      
      console.error(`API请求异常: ${endpoint}`, error.message);
      throw error;
    }
  }

  // 修改调用AI模型的方法，加强调试信息输出和修复上下文传递问题
  async callAIModel(authKey, modelConfig, message, context = []) {
    try {
      // 确保base_url末尾没有斜杠
      const baseUrl = modelConfig.base_url.replace(/\/$/, '');
      
      // 修复：移除URL中重复的/v1
      const endpoint = '/chat/completions';
      const url = `${baseUrl}${endpoint}`;
      
      // 添加请求超时和abort控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
      
      console.log(`调用AI模型: ${modelConfig.model}, 消息长度: ${message.length}字符`);
      
      // 修复系统提示词中的重复时间戳
      const fixedSystemPrompt = modelConfig.system_prompt.replace(/(\[\w+\/\d+\/\d+ \d+:\d+:\d+)(\1)+/, '$1');
      
      // 构建消息数组
      const messages = [
        { 
          role: 'system', 
          content: fixedSystemPrompt
        }
      ];
      
      // 添加上下文消息，确保格式正确
      if (context && context.length > 0) {
        console.log(`添加 ${context.length} 条上下文消息`);
        
        // 确保上下文消息按时间顺序排列（旧消息在前，新消息在后）
        context.forEach((ctx, index) => {
          // 确保每个上下文消息都有有效的角色和内容
          if (ctx && ctx.role && ctx.content) {
            messages.push({
              role: ctx.role,
              content: ctx.content
            });
            
            // 添加更详细的日志，显示每条上下文消息
            console.log(`- 上下文[${index}]: ${ctx.role}: ${ctx.content.substring(0, 30)}${ctx.content.length > 30 ? '...' : ''}`);
          }
        });
      }
      
      // 添加当前用户消息
      messages.push({ role: 'user', content: message });
      
      console.log(`最终发送给AI的消息数组长度: ${messages.length}`);
      console.log(`- 系统提示词: ${fixedSystemPrompt.substring(0, 50)}...`);
      console.log(`- 上下文消息: ${context.length} 条`);
      console.log(`- 用户消息: ${message}`);
      
      // 输出完整的请求信息用于调试
      console.log('发送给AI的完整消息数组：');
      messages.forEach((msg, idx) => {
        console.log(`[${idx}] ${msg.role}: ${msg.content.length > 100 ? `${msg.content.substring(0, 100)}...` : msg.content}`);
      });
      
      const response = await axios.post(url, {
        model: modelConfig.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${modelConfig.api_key}`,
          'Accept': 'application/json',
          'User-Agent': 'PostmanRuntime/7.36.0',  // 统一User-Agent
          'Connection': 'keep-alive'
        },
        signal: controller.signal,
        timeout: 60000,
        decompress: true
      });
      
      clearTimeout(timeoutId);
      
      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('AI响应格式错误');
      }

      const aiResponse = response.data.choices[0].message.content;
      console.log(`AI响应成功，响应长度: ${aiResponse.length}字符`);
      return aiResponse;
    } catch (error) {
      // 增强错误处理
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        console.error(`AI请求超时`);
        throw new Error('AI服务请求超时');
      }
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error(`AI请求失败 (${error.response.status})`);
          console.error('响应数据:', error.response.data);
          
          // 根据状态码返回具体错误信息
          switch (error.response.status) {
            case 401:
              throw new Error('API密钥无效，请检查配置');
            case 403:
              throw new Error('API权限不足，请检查配置');
            case 404:
              throw new Error('API端点不存在，请检查base_url配置');
            case 429:
              throw new Error('API调用次数超限');
            case 500:
              throw new Error('AI服务器内部错误');
            default:
              throw new Error(`AI服务错误: ${error.response.status}`);
          }
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('AI服务请求超时');
        } else {
          console.error(`AI请求连接错误:`, error.message);
          throw new Error('无法连接到AI服务器');
        }
      }
      
      console.error(`AI请求其他错误:`, error);
      throw error;
    }
  }
}

// 创建服务实例
const wsService = new WebSocketService();

// 启动服务
wsService.initialize().catch(console.error);

// 启动HTTP服务器
server.listen(PORT, () => {
  const interfaces = os.networkInterfaces();
  let ipAddress = 'localhost'; // 默认值为localhost

  // 遍历网络接口，获取第一个有效的IPv4地址
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ipAddress = iface.address;
        break;
      }
    }
  }

  console.log(`HTTP服务器已启动，监听端口 ${PORT}`);
  console.log(`- 访问 http://${ipAddress}:${PORT} 查看服务状态`);
  console.log(`- 访问 http://${ipAddress}:${PORT}/wss_log 查看服务日志`);
});

// 优雅退出
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭连接...');
  for (const botId of wsService.connections.keys()) {
    wsService.disconnect(botId);
  }
  server.close(() => {
    console.log('HTTP服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭连接...');
  for (const botId of wsService.connections.keys()) {
    wsService.disconnect(botId);
  }
  server.close(() => {
    console.log('HTTP服务器已关闭');
    process.exit(0);
  });
});

// 在文件末尾添加未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  if (error.stack) {
    console.error('错误堆栈:', error.stack);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  if (reason.stack) {
    console.error('错误堆栈:', reason.stack);
  }
}); 