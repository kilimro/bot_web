import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Play, Save, HelpCircle, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { uploadFriendCircleImage } from '../services/api';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism.css';

interface Plugin {
  id: string;
  name: string;
  description: string;
  trigger: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  description: string;
  trigger: string;
  code: string;
  is_active: boolean;
}

interface TestResult {
  success: boolean;
  message: string;
  output?: string[];
  error?: string;
}

const PLUGIN_GUIDE = {
  title: '插件编写指南',
  sections: [
    {
      title: '基本结构',
      content: `插件代码必须包含以下部分：
1. 触发器定义 (// [trigger: 命令名])
2. 主函数 (async function main() { ... })

示例:
// [trigger: 天气?]
async function main() {
  const city = param(1);
  if (!city) {
    sendText('请输入要查询的城市名称');
    return;
  }
  
  try {
    console.log('开始查询天气:', city);
    const response = await request({
      url: 'https://xiaoapi.cn/API/zs_tq.php?type=cytq&msg=' + encodeURIComponent(city) + '&num=20&n=1',
      dataType: 'json',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    console.log('天气API响应:', response);
    
    if (!response || !response.data) {
      throw new Error('API返回数据格式错误');
    }
    
    sendText(\`\${city}的天气：\${response.data}\`);
  } catch (error) {
    console.error('获取天气失败:', error);
    sendText(\`获取天气信息失败: \${error.message || '请稍后重试'}\`);
  }
}`
    },
    {
      title: '可用API',
      content: `插件可以使用以下API:

1. 消息发送
   - sendText(message: string) - 发送文本消息
   - sendImage(url: string) - 发送图片消息
   - sendVoice(url: string) - 发送语音消息
   - sendFile(url: string) - 发送文件

2. 请求处理
   - request(options) - 发送HTTP请求
     参数:
     - url: string (必需)
     - method: 'get'|'post'|'put'|'delete' (可选)
     - dataType: 'json'|'text' (可选)
     - headers: object (可选)
     - timeout: number (可选，默认30000ms)

3. 消息信息
   - param(index: number) - 获取用户输入的参数
   - getUserId() - 获取发送者ID
   - getChatId() - 获取群聊ID
   - getSenderName() - 获取发送者昵称
   - isPrivateChat() - 是否为私聊
   - isGroupChat() - 是否为群聊
   - getMessageType() - 获取消息类型

4. 工具函数
   - filterEmoji(text: string) - 过滤表情符号
   - encodeURIComponent(text: string) - URL编码
   - decodeURIComponent(text: string) - URL解码
   - formatDate(date: Date, format: string) - 日期格式化
   - random(min: number, max: number) - 生成随机数
   - sleep(ms: number) - 延迟执行`
    },
    {
      title: '参数处理',
      content: `有两种类型的触发器:

1. 无参数触发器
// [trigger: 菜单]
async function main() {
  sendText('这是菜单内容');
}

2. 带参数触发器 
// [trigger: 翻译?]
async function main() {
  const text = param(1); // 获取第一个参数
  if (!text) return sendText('请输入要翻译的内容');
  // ... 翻译逻辑
}`
    },
    {
      title: '群聊控制',
      content: `群聊相关功能示例:

// [trigger: 群管理]
async function main() {
  if (!isGroupChat()) {
    sendText('此功能仅限群聊使用');
    return;
  }

  const chatId = getChatId();
  const allowedGroups = ['20040454588', '21218202933'];
  
  if (!allowedGroups.includes(chatId)) {
    sendText('此群未授权使用此功能');
    return;
  }

  // 群管理逻辑
}`
    },
    {
      title: '错误处理',
      content: `始终使用 try-catch 处理可能的错误:

async function main() {
  try {
    const response = await request({
      url: 'https://api.example.com/data'
    });
    sendText(response.data);
  } catch (error) {
    sendText('发生错误: ' + error.message);
  }
}`
    },
    {
      title: '最佳实践',
      content: `1. 添加适当的注释说明功能
2. 验证用户输入
3. 提供友好的错误提示
4. 使用 async/await 处理异步操作
5. 保持代码简洁清晰
6. 测试不同的输入场景
7. 合理使用日志记录
8. 注意性能优化`
    }
  ]
};

const PluginsPage: React.FC = () => {
  const { user } = useAuth();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingPlugin, setTestingPlugin] = useState<Plugin | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    trigger: '',
    code: '// [trigger: 命令名]\nasync function main() {\n  // 在这里编写插件代码\n}',
    is_active: true
  });
  const [showAIGenModal, setShowAIGenModal] = useState(false);
  const [aiForm, setAiForm] = useState({
    name: '',
    trigger: '',
    apiUrl: '',
    method: 'GET',
    paramDesc: '',
    responsePath: '',
    sendType: 'text',
    errorTip: '',
    returnType: 'json',
    params: ''
  });
  const [aiCode, setAiCode] = useState('');
  const [aiCopied, setAiCopied] = useState(false);

  useEffect(() => {
    fetchPlugins();
  }, [user]);

  const fetchPlugins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plugins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlugins(data || []);
    } catch (error) {
      console.error('Error fetching plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user?.id) {
        throw new Error('用户未登录');
      }

      if (editingPlugin) {
        const { error } = await supabase
          .from('plugins')
          .update({
            name: formData.name,
            description: formData.description,
            trigger: formData.trigger,
            code: formData.code,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPlugin.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plugins')
          .insert([{
            ...formData,
            user_id: user.id
          }]);

        if (error) throw error;
      }
      
      setShowAddModal(false);
      setEditingPlugin(null);
      resetForm();
      await fetchPlugins();
    } catch (error) {
      console.error('Error saving plugin:', error);
      alert(error instanceof Error ? error.message : '保存插件失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个插件吗？')) return;
    
    try {
      const { error } = await supabase
        .from('plugins')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      fetchPlugins();
    } catch (error) {
      console.error('Error deleting plugin:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger: '',
      code: '// [trigger: 命令名]\nasync function main() {\n  // 在这里编写插件代码\n}',
      is_active: true
    });
  };

  const handleTest = async (plugin: Plugin) => {
    setTestingPlugin(plugin);
    setTestInput('');
    setTestResult(null);
    setShowTestModal(true);
  };

  const runTest = async () => {
    if (!testingPlugin) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      // Extract trigger pattern
      const triggerMatch = testingPlugin.code.match(/\/\/\s*\[trigger:\s*([^\]]+)\]/);
      if (!triggerMatch) {
        throw new Error('未找到触发器定义');
      }

      const trigger = triggerMatch[1].trim();
      const hasParams = trigger.endsWith('?');
      const params = hasParams && testInput ? testInput.split(/\s+/) : [];

      // Create sandbox environment
      const sandbox = {
        messages: [] as string[],
        sendText: (text: string) => {
          sandbox.messages.push(String(text));
        },
        sendImage: async (url: string) => {
          try {
            // 获取当前用户的在线机器人
            const { data: bots, error: botsError } = await supabase
              .from('bots')
              .select('*')
              .eq('status', 'online')
              .single();

            if (botsError || !bots) {
              throw new Error('未找到在线的机器人');
            }

            // 获取图片并转换为base64
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`获取图片失败: ${response.status} ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const mimeType = response.headers.get('content-type') || 'image/png';
            const base64Data = `data:${mimeType};base64,${base64}`;

            // 上传图片到朋友圈
            const uploadResponse = await uploadFriendCircleImage(bots.auth_key, base64Data);
            
            if (uploadResponse.Code === 200) {
              const imageData = uploadResponse.Data[0].resp;
              sandbox.messages.push(`[图片] ${imageData.FileURL}`);
            } else {
              throw new Error(uploadResponse.Text || '上传图片失败');
            }
          } catch (error) {
            sandbox.messages.push(`发送图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
          }
        },
        request: async ({ url, method = 'get', dataType = 'text', headers = {} }: {
          url: string;
          method?: string;
          dataType?: 'json' | 'text';
          headers?: Record<string, string>;
        }) => {
          if (!url) {
            throw new Error('URL is required for the request');
          }

          try {
            new URL(url);
          } catch (error) {
            throw new Error(`Invalid URL: ${url}`);
          }

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            // 使用 XMLHttpRequest 替代 fetch
            const xhr = new XMLHttpRequest();
            xhr.open(method.toUpperCase(), url, true);
            xhr.responseType = dataType === 'json' ? 'text' : 'arraybuffer';
            
            // 只设置安全的请求头
            Object.entries(headers).forEach(([key, value]) => {
              if (!['User-Agent', 'Host', 'Origin', 'Referer'].includes(key)) {
                xhr.setRequestHeader(key, value);
              }
            });

            const response = await new Promise((resolve, reject) => {
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  if (dataType === 'json') {
                    try {
                      resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                      reject(new Error('Invalid JSON response'));
                    }
                  } else {
                    // 将 ArrayBuffer 转换为 base64
                    const bytes = new Uint8Array(xhr.response as ArrayBuffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                      binary += String.fromCharCode(bytes[i]);
                    }
                    resolve(btoa(binary));
                  }
                } else {
                  reject(new Error(`HTTP error! status: ${xhr.status}`));
                }
              };
              xhr.onerror = () => reject(new Error('Network error'));
              xhr.ontimeout = () => reject(new Error('Request timeout'));
              xhr.send();
            });

            clearTimeout(timeout);
            return response;
          } catch (error) {
            if (error instanceof Error) {
              if (error.name === 'AbortError') {
                throw new Error('请求超时');
              }
            }
            throw error;
          }
        },
        param: (index: number) => params[index - 1] || ''
      };

      // Create test function with proper error handling
      const fn = new Function('sandbox', `
        with (sandbox) {
          return (async () => {
            try {
              ${testingPlugin.code}
              await main();
            } catch (error) {
              if (error instanceof Error) {
                throw error;
              }
              throw new Error(String(error));
            }
          })();
        }
      `);

      // Execute test
      await fn(sandbox);

      setTestResult({
        success: true,
        message: '测试成功',
        output: sandbox.messages
      });
    } catch (error) {
      console.error('Test error:', error);
      setTestResult({
        success: false,
        message: '测试失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleAIGenerate = () => {
    // 生成插件代码模板
    const {
      name, trigger, apiUrl, method, paramDesc, responsePath, errorTip, returnType, params
    } = aiForm;
    const triggerLine = trigger ? `// [trigger: ${trigger}]` : '// [trigger: 命令?]';
    const paramLine = paramDesc ? `  // 参数说明: ${paramDesc}\n` : '';
    const paramGet = `  const input = param(1);\n  if (!input) {\n    sendText('请输入${paramDesc || '内容'}');\n    return;\n  }\n`;
    let sendLine = '';
    if (returnType === 'json') {
      sendLine = `    sendText(\`结果：\n\${${responsePath || 'response'}}\n\`);\n`;
    } else if (returnType === 'text') {
      sendLine = `    sendText(response);\n`;
    } else if (returnType === 'image') {
      sendLine = `    sendImage(response);\n`;
    }
    const errorLine = errorTip ? errorTip : '请稍后重试';

    // 处理请求参数
    let paramObj = '';
    let paramStr = '';
    if (params) {
      // 解析参数字符串，生成对象和url参数
      const paramArr = params.split('&').map(p => p.trim()).filter(Boolean);
      paramObj = paramArr.map(p => {
        const [k, v] = p.split('=');
        if (v && v.includes('用户输入')) {
          return `${k}: input`;
        } else if (v) {
          return `${k}: '${v}'`;
        } else {
          return '';
        }
      }).filter(Boolean).join(', ');
      paramStr = paramArr.map(p => {
        const [k, v] = p.split('=');
        if (v && v.includes('用户输入')) {
          return `${k}=[36m[1m\${encodeURIComponent(input)}\u001b[22m[39m`;
        } else if (v) {
          return `${k}=${v}`;
        } else {
          return '';
        }
      }).filter(Boolean).join('&');
    }

    let urlLine = '';
    let dataLine = '';
    if (method === 'GET') {
      urlLine = paramStr ? `${apiUrl}${apiUrl && !apiUrl.includes('?') ? '?' : ''}${paramStr}` : apiUrl;
    } else if (method === 'POST') {
      urlLine = apiUrl;
      dataLine = paramObj ? `data: { ${paramObj} },` : '';
    }

    let code = `${triggerLine}
async function main() {
${paramLine}${paramGet}  try {
    const response = await request({
      url: \
        \
        '${method === 'GET' ? urlLine : apiUrl}',
      method: '${method}',
      ${method === 'POST' && dataLine ? dataLine + '\n      ' : ''}dataType: '${returnType}',
    });
    if (!response) throw new Error('API无响应');
${sendLine}  } catch (error) {
    sendText('操作失败: ' + (error instanceof Error ? error.message : '${errorLine}'));
  }
}`;
    setAiCode(code);
    setAiCopied(false);
  };

  const handleAICopy = () => {
    navigator.clipboard.writeText(aiCode);
    setAiCopied(true);
    setTimeout(() => setAiCopied(false), 1500);
  };

  const filteredPlugins = plugins.filter(plugin =>
    plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plugin.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plugin.trigger.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">插件中心</h1>
          <p className="text-gray-600">管理和编写自定义插件</p>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowGuide(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center"
          >
            <HelpCircle size={18} className="mr-2" />
            编写指南
          </button>
          <button
            onClick={() => setShowAIGenModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
          >
            <HelpCircle size={18} className="mr-2" />
            AI帮写
          </button>
          <button
            onClick={() => {
              setEditingPlugin(null);
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus size={18} className="mr-2" />
            添加插件
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="搜索插件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">没有找到匹配的插件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlugins.map(plugin => (
            <div key={plugin.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{plugin.name}</h3>
                  <p className="text-sm text-gray-500">{plugin.description}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingPlugin(plugin);
                      setFormData({
                        name: plugin.name,
                        description: plugin.description || '',
                        trigger: plugin.trigger,
                        code: plugin.code,
                        is_active: plugin.is_active
                      });
                      setShowAddModal(true);
                    }}
                    className="p-1.5 text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(plugin.id)}
                    className="p-1.5 text-gray-600 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  {plugin.trigger}
                </code>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${plugin.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                  {plugin.is_active ? '已启用' : '已禁用'}
                </span>
                <button
                  onClick={() => handleTest(plugin)}
                  className="text-blue-600 hover:text-blue-700 flex items-center text-sm"
                >
                  <Play size={14} className="mr-1" />
                  测试
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">{PLUGIN_GUIDE.title}</h3>
              <button
                onClick={() => setShowGuide(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-8">
                {PLUGIN_GUIDE.sections.map((section, index) => (
                  <div key={index}>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      {section.title}
                    </h4>
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                      {section.content}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowGuide(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">
                {editingPlugin ? '编辑插件' : '添加新插件'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    插件名称
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="输入插件名称"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="简要描述插件功能"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    触发命令
                  </label>
                  <input
                    type="text"
                    value={formData.trigger}
                    onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例如: 天气? 或 菜单"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    代码
                  </label>
                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    <Editor
                      value={formData.code}
                      onValueChange={(code: string) => setFormData({ ...formData, code })}
                      highlight={(code: string) => highlight(code, languages.javascript, 'javascript')}
                      padding={10}
                      style={{
                        fontFamily: '"Fira code", "Fira Mono", monospace',
                        fontSize: 14,
                        minHeight: '300px',
                        backgroundColor: '#f8f9fa',
                        lineHeight: 1.5
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    启用插件
                  </label>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <Save size={18} className="mr-2" />
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTestModal && testingPlugin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">测试插件</h3>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  触发命令: <code className="text-blue-600">{testingPlugin.trigger}</code>
                </label>
                {testingPlugin.trigger.endsWith('?') && (
                  <input
                    type="text"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="输入测试参数"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {testResult && (
                <div className={`mb-4 p-4 rounded-lg ${
                  testResult.success ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div className={`font-medium mb-2 ${
                    testResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {testResult.message}
                  </div>
                  {testResult.error ? (
                    <pre className="text-red-600 text-sm whitespace-pre-wrap">
                      {testResult.error}
                    </pre>
                  ) : testResult.output && testResult.output.length > 0 ? (
                    <div className="space-y-2">
                      {testResult.output.map((msg: string, index: number) => (
                        <div key={index} className="p-2 bg-white rounded border border-gray-200">
                          {msg}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  关闭
                </button>
                <button
                  onClick={runTest}
                  disabled={testLoading}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center ${
                    testLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {testLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      测试中...
                    </>
                  ) : (
                    <>
                      <Play size={16} className="mr-2" />
                      运行测试
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAIGenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">AI帮写插件</h3>
              <button onClick={() => setShowAIGenModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">插件名称</label>
                  <input type="text" value={aiForm.name} onChange={e => setAiForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="可选" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">触发命令</label>
                  <input type="text" value={aiForm.trigger} onChange={e => setAiForm(f => ({ ...f, trigger: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="如：翻译?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
                  <input type="text" value={aiForm.apiUrl} onChange={e => setAiForm(f => ({ ...f, apiUrl: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="如：https://api.xxx.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">请求方式</label>
                  <select value={aiForm.method} onChange={e => setAiForm(f => ({ ...f, method: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">请求参数</label>
                  <input type="text" value={aiForm.params || ''} onChange={e => setAiForm(f => ({ ...f, params: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="如：msg=用户输入内容&lang=zh" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">参数说明</label>
                  <input type="text" value={aiForm.paramDesc} onChange={e => setAiForm(f => ({ ...f, paramDesc: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="如：msg=用户输入内容" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">返回类型</label>
                  <select value={aiForm.returnType || 'json'} onChange={e => setAiForm(f => ({ ...f, returnType: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="json">json</option>
                    <option value="text">text</option>
                    <option value="image">image</option>
                  </select>
                </div>
                {aiForm.returnType === 'json' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">返回内容取值</label>
                    <input type="text" value={aiForm.responsePath} onChange={e => setAiForm(f => ({ ...f, responsePath: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="如：response.data" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">错误提示</label>
                  <input type="text" value={aiForm.errorTip} onChange={e => setAiForm(f => ({ ...f, errorTip: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="如：翻译失败" />
                </div>
              </div>
              <button
                onClick={handleAIGenerate}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors mt-4"
              >
                生成代码
              </button>
              {aiCode && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">生成的插件代码</label>
                  <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto whitespace-pre-wrap max-h-48">{aiCode}</pre>
                  <button
                    onClick={handleAICopy}
                    className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                  >
                    <Copy size={16} className="mr-1" />
                    {aiCopied ? '已复制' : '复制代码'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginsPage;