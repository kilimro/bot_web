import React, { useState, useEffect } from 'react';
import { Plus, Copy, CheckCircle2, Trash2, RefreshCw, Clock } from 'lucide-react';
import { generateAuthKey, delayAuthKey } from '../services/api';
import { supabase } from '../lib/supabase';

interface AuthKey {
  id: string;
  key: string;
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
}

const AuthKeysPage: React.FC = () => {
  const [authKeys, setAuthKeys] = useState<AuthKey[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDelaying, setIsDelaying] = useState<boolean>(false);
  const [days, setDays] = useState<number>(30);
  const [count, setCount] = useState<number>(1);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [delayKey, setDelayKey] = useState<string>('');
  const [delayDays, setDelayDays] = useState<number>(30);
  
  // 从 Supabase 加载授权密钥
  useEffect(() => {
    loadAuthKeys();
  }, []);

  const loadAuthKeys = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: keys, error } = await supabase
        .from('auth_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (keys) {
        setAuthKeys(keys.map(key => ({
          id: key.id,
          key: key.key,
          createdAt: key.created_at,
          expiresAt: key.expires_at,
          isUsed: key.is_used
        })));
      }
    } catch (error) {
      console.error('加载授权密钥失败:', error);
      setError('加载授权密钥失败');
    }
  };

  const handleGenerateAuthKey = async () => {
    try {
      setIsGenerating(true);
      setError('');
      const response = await generateAuthKey(count, days);
      
      if (response.Code === 200 && response.Data && response.Data.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('用户未登录');

        const now = new Date();
        const newKeys = response.Data.map((key: string) => {
          const expirationDate = new Date(now);
          expirationDate.setDate(expirationDate.getDate() + days);
          
          return {
            key: key,
            user_id: user.id,
            created_by: user.id,
            expires_at: expirationDate.toISOString(),
            is_used: false
          };
        });

        const { error } = await supabase
          .from('auth_keys')
          .insert(newKeys);

        if (error) throw error;

        await loadAuthKeys();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setError('生成授权密钥失败: ' + (response.Text || '未知错误'));
      }
    } catch (error) {
      console.error('生成授权密钥失败:', error);
      setError('生成授权密钥时发生错误');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelayAuthKey = async () => {
    if (!delayKey) {
      setError('请输入要续期的授权密钥');
      return;
    }

    try {
      setIsDelaying(true);
      setError('');
      
      
      const response = await delayAuthKey(delayKey, delayDays);
      
      if (response.Code === 200 && response.Data) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('用户未登录');

        
        const { error } = await supabase
          .from('auth_keys')
          .update({ 
            expires_at: response.Data.expiryDate
          })
          .eq('key', delayKey)
          .eq('user_id', user.id);

        if (error) {
          console.error('更新数据库失败:', error);
          throw error;
        }

        await loadAuthKeys();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setDelayKey('');
      } else {
        const errorMessage = response.Text || '续期失败';
        console.error('续期失败:', errorMessage);
        setError(`续期失败: ${errorMessage}`);
      }
    } catch (error) {
      console.error('续期时发生错误:', error);
      setError(`续期时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsDelaying(false);
    }
  };
  
  const handleCopyAuthKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };
  
  const handleDeleteAuthKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('auth_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadAuthKeys();
    } catch (error) {
      console.error('删除授权密钥失败:', error);
      setError('删除授权密钥失败');
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">授权密钥管理</h1>
          <p className="text-gray-600">创建和管理机器人的授权密钥</p>
        </div>
      </div>
      
      {showSuccess && (
        <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg flex items-center">
          <CheckCircle2 size={20} className="mr-2" />
          <span>操作成功！</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-bold text-gray-800">生成新的授权密钥</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  有效期（天）
                </label>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={7}>7天</option>
                  <option value={30}>30天</option>
                  <option value={90}>90天</option>
                  <option value={180}>180天</option>
                  <option value={365}>365天</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  生成数量
                </label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1个</option>
                  <option value={5}>5个</option>
                  <option value={10}>10个</option>
                  <option value={20}>20个</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={handleGenerateAuthKey}
              disabled={isGenerating}
              className={`w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center ${
                isGenerating ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  生成中...
                </>
              ) : (
                <>
                  <Plus size={18} className="mr-2" />
                  生成授权密钥
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-bold text-gray-800">授权密钥续期</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  授权密钥
                </label>
                <input
                  type="text"
                  value={delayKey}
                  onChange={(e) => setDelayKey(e.target.value)}
                  placeholder="输入要续期的授权密钥"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  续期天数
                </label>
                <select
                  value={delayDays}
                  onChange={(e) => setDelayDays(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={7}>7天</option>
                  <option value={30}>30天</option>
                  <option value={90}>90天</option>
                  <option value={180}>180天</option>
                  <option value={365}>365天</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={handleDelayAuthKey}
              disabled={isDelaying}
              className={`w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center justify-center ${
                isDelaying ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isDelaying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  续期中...
                </>
              ) : (
                <>
                  <Clock size={18} className="mr-2" />
                  续期授权密钥
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">授权密钥列表</h2>
          <button 
            onClick={loadAuthKeys} 
            className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  授权密钥
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  过期时间
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {authKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    暂无授权密钥，点击上方按钮生成
                  </td>
                </tr>
              ) : (
                authKeys.map((authKey) => (
                  <tr key={authKey.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 mr-2 truncate max-w-xs">
                          {authKey.key}
                        </div>
                        <button
                          onClick={() => handleCopyAuthKey(authKey.id, authKey.key)}
                          className="text-gray-400 hover:text-blue-600 focus:outline-none"
                        >
                          {copiedId === authKey.id ? (
                            <CheckCircle2 size={16} className="text-green-500" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(authKey.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(authKey.expiresAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isExpired(authKey.expiresAt) ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          已过期
                        </span>
                      ) : authKey.isUsed ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          已使用
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          未使用
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDeleteAuthKey(authKey.id)}
                        className="text-red-600 hover:text-red-800 focus:outline-none"
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
    </div>
  );
};

export default AuthKeysPage;