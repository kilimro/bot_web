import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import axios from 'axios';

interface SystemSettings {
  systemName: string;
  apiBaseUrl: string;
  wsBaseUrl: string;
  adminUsername: string;
  adminPassword: string;
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    systemName: 'bot机器人管理平台',
    apiBaseUrl: 'https://855部署的地址',
    wsBaseUrl: 'wss://855部署的地址/ws',
    adminUsername: 'admin',
    adminPassword: '',
  });

  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showError, setShowError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 从后端获取当前设置
    const fetchSettings = async () => {
      try {
        const response = await axios.get('/api/settings');
        setSettings(response.data);
      } catch (error) {
        console.error('获取设置失败:', error);
        setShowError('获取设置失败，请刷新页面重试');
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setShowError('');
    
    try {
      // 调用API保存设置
      await axios.post('/api/settings', settings);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (error) {
      console.error('保存设置失败:', error);
      setShowError('保存设置失败，请检查网络连接后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">系统设置</h1>
        <p className="text-gray-600">配置系统基本参数和功能</p>
      </div>

      {showSaveSuccess && (
        <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg flex items-center">
          <AlertTriangle size={20} className="mr-2" />
          <span>设置已成功保存</span>
        </div>
      )}

      {showError && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">
          {showError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">基本设置</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  系统名称
                </label>
                <input
                  type="text"
                  value={settings.systemName}
                  onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API基础地址
                </label>
                <input
                  type="text"
                  value={settings.apiBaseUrl}
                  onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WebSocket地址
                </label>
                <input
                  type="text"
                  value={settings.wsBaseUrl}
                  onChange={(e) => setSettings({ ...settings, wsBaseUrl: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">管理员账号</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  管理员用户名
                </label>
                <input
                  type="text"
                  value={settings.adminUsername}
                  onChange={(e) => setSettings({ ...settings, adminUsername: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  修改密码
                </label>
                <input
                  type="password"
                  value={settings.adminPassword}
                  onChange={(e) => setSettings({ ...settings, adminPassword: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="留空表示不修改密码"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Save size={18} className="mr-2" />
              {isLoading ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;