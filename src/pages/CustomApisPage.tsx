import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Play, Code, Settings } from 'lucide-react';
import { Monaco } from '@monaco-editor/react';
import Editor from '@monaco-editor/react';
import { supabase } from '../lib/supabase';

interface Plugin {
  id: string;
  name: string;
  description: string;
  trigger: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const PLUGIN_TEMPLATES = {
  simple: `// 无参数插件示例
// [trigger: 电影热榜]
async function main() {
  try {
    const response = await fetch('https://api.920pdd.com/API/dyrbang.php?type=douban&num=10');
    const data = await response.json();
    return \`最近电影热榜：\n\${data.msg}\`;
  } catch (error) {
    console.error('请求失败:', error);
    return '获取电影热榜失败，请稍后重试';
  }
}`,
  parameterized: `// 带参数插件示例
// [trigger: 翻译?]
async function main(text) {
  if (!text) return '请输入要翻译的内容';
  
  try {
    const response = await fetch(\`https://api.920pdd.com/API/fy.php?msg=\${encodeURIComponent(text)}\`);
    const result = await response.text();
    return result;
  } catch (error) {
    console.error('翻译失败:', error);
    return '翻译失败，请稍后重试';
  }
}`
};

const CustomApisPage: React.FC = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: '',
    code: PLUGIN_TEMPLATES.simple,
    is_active: true
  });

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      const { data: plugins, error } = await supabase
        .from('plugins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlugins(plugins || []);
    } catch (error) {
      console.error('加载插件失败:', error);
      setError('加载插件失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
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
            name: formData.name,
            description: formData.description,
            trigger: formData.trigger,
            code: formData.code,
            is_active: formData.is_active
          }]);

        if (error) throw error;
      }

      await loadPlugins();
      setShowEditor(false);
      setEditingPlugin(null);
      resetForm();
    } catch (error) {
      console.error('保存插件失败:', error);
      setError('保存插件失败');
    }
  };

  const handleEdit = (plugin: Plugin) => {
    setEditingPlugin(plugin);
    setFormData({
      name: plugin.name,
      description: plugin.description,
      trigger: plugin.trigger,
      code: plugin.code,
      is_active: plugin.is_active
    });
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('plugins')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadPlugins();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('删除插件失败:', error);
      setError('删除插件失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger: '',
      code: PLUGIN_TEMPLATES.simple,
      is_active: true
    });
  };

  const handleTest = async () => {
    try {
      setTestResult(null);
      
      // Extract trigger pattern and parameters
      const triggerMatch = formData.code.match(/\/\/\s*\[trigger:\s*([^\]]+)\]/);
      if (!triggerMatch) {
        throw new Error('未找到触发器定义');
      }

      const trigger = triggerMatch[1].trim();
      const hasParams = trigger.includes('?');
      
      // Create test function
      const functionBody = formData.code
        .replace(/\/\/[^\n]*/g, '') // Remove comments
        .trim();

      const testFunction = new Function('text', `
        return (async () => {
          ${functionBody}
          return await main(${hasParams ? '"测试文本"' : ''});
        })();
      `);

      // Execute test
      const result = await testFunction();
      setTestResult(result);
    } catch (error) {
      console.error('测试失败:', error);
      setTestResult(`测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const filteredPlugins = plugins.filter(plugin =>
    plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plugin.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plugin.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">插件中心</h1>
          <p className="text-gray-600">创建和管理自定义插件</p>
        </div>
        <button
          onClick={() => {
            setEditingPlugin(null);
            resetForm();
            setShowEditor(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus size={18} className="mr-2" />
          创建插件
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
          <AlertTriangle size={20} className="mr-2" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索插件名称或触发词..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  插件名称
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  触发词
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  描述
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPlugins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    暂无插件
                  </td>
                </tr>
              ) : (
                filteredPlugins.map((plugin) => (
                  <tr key={plugin.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Code size={20} className="text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">{plugin.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {plugin.trigger}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 line-clamp-2">{plugin.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        plugin.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {plugin.is_active ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(plugin.updated_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(plugin)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="编辑"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(plugin.id)}
                        className="text-red-600 hover:text-red-900"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">
                {editingPlugin ? '编辑插件' : '创建新插件'}
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      插件名称
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      触发词
                    </label>
                    <input
                      type="text"
                      value={formData.trigger}
                      onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如: 天气? 或 电影热榜"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    插件描述
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="简要描述插件功能"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      插件代码
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, code: PLUGIN_TEMPLATES.simple })}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        无参数模板
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, code: PLUGIN_TEMPLATES.parameterized })}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        带参数模板
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    <Editor
                      height="400px"
                      defaultLanguage="javascript"
                      value={formData.code}
                      onChange={(value) => setFormData({ ...formData, code: value || '' })}
                      theme="vs-light"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">启用插件</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleTest}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
                  >
                    <Play size={16} className="mr-2" />
                    测试插件
                  </button>
                </div>

                {testResult && (
                  <div className={`p-4 rounded-md ${
                    testResult.includes('失败') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                  }`}>
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {testResult}
                    </pre>
                  </div>
                )}
              </form>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowEditor(false);
                  setEditingPlugin(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {editingPlugin ? '保存修改' : '创建插件'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center text-red-600 mb-4">
              <AlertTriangle size={24} className="mr-2" />
              <h3 className="text-lg font-medium">确认删除</h3>
            </div>
            <p className="text-gray-600 mb-6">
              您确定要删除这个插件吗？此操作无法撤销。
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomApisPage;