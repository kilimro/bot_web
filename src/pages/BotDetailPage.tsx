import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Bot, RefreshCw, Trash2, AlertTriangle, Footprints, Hand } from 'lucide-react';
import { Bot as BotType, BotProfile } from '../types';
import { getBotDetail, getBotProfile, getUserProfile, updateBotProfile, deleteBot, updateStepNumber, setSendPat } from '../services/api';

const BotDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bot, setBot] = useState<BotType | null>(null);
  const [profile, setProfile] = useState<BotProfile | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // 新增状态
  const [stepNumber, setStepNumber] = useState<number>(0);
  const [patValue, setPatValue] = useState<string>('');
  const [showStepModal, setShowStepModal] = useState(false);
  const [showPatModal, setShowPatModal] = useState(false);
  const [toolsLoading, setToolsLoading] = useState<{[key: string]: boolean}>({
    step: false,
    pat: false
  });

  useEffect(() => {
    loadBotDetail();
  }, [id]);

  const loadBotDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [botData, profileData] = await Promise.all([
        getBotDetail(id),
        getBotProfile(id)
      ]);
      
      setBot(botData);
      setProfile(profileData);
    } catch (error) {
      console.error('加载机器人详情失败:', error);
      setError('加载机器人详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshProfile = async () => {
    if (!bot?.id || !bot.auth_key || bot.status !== 'online') return;
    
    try {
      setRefreshing(true);
      setError('');
      
      const userProfile = await getUserProfile(bot.auth_key);
      if (userProfile.Code === 200) {
        const { userInfo, userInfoExt } = userProfile.Data;
        const profileData = {
          bot_id: bot.id,
          username: userInfo.userName.str,
          nickname: userInfo.nickName.str,
          bind_uin: userInfo.bindUin,
          bind_email: userInfo.bindEmail.str,
          bind_mobile: userInfo.bindMobile.str,
          sex: userInfo.sex,
          level: userInfo.level,
          experience: userInfo.experience,
          alias: userInfo.alias,
          big_head_img_url: userInfoExt.bigHeadImgUrl,
          small_head_img_url: userInfoExt.smallHeadImgUrl,
          updated_at: new Date().toISOString()
        };

        try {
          const updatedProfile = await updateBotProfile(profileData);
          setProfile(updatedProfile);
        } catch (error) {
          throw new Error('保存用户资料失败');
        }
      } else {
        throw new Error(userProfile.Text || '获取用户资料失败');
      }
    } catch (error) {
      console.error('刷新用户资料失败:', error);
      setError(error instanceof Error ? error.message : '刷新用户资料失败，请稍后重试');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!bot?.id) return;
    try {
      await deleteBot(bot.id);
      navigate('/bots');
    } catch (error) {
      console.error('删除机器人失败:', error);
      setError('删除机器人失败');
    }
  };

  const handleUpdateStepNumber = async () => {
    if (!bot || stepNumber < 0 || stepNumber > 99999) return;
    
    try {
      setToolsLoading(prev => ({ ...prev, step: true }));
      setError('');
      
      const response = await updateStepNumber(bot.auth_key, stepNumber);
      if (response.Code === 200) {
        setShowStepModal(false);
        setStepNumber(0);
      } else {
        throw new Error(response.Text || '修改步数失败');
      }
    } catch (error) {
      console.error('修改步数失败:', error);
      setError(error instanceof Error ? error.message : '修改步数失败');
    } finally {
      setToolsLoading(prev => ({ ...prev, step: false }));
    }
  };

  const handleSetSendPat = async () => {
    if (!bot || !patValue.trim()) return;
    
    try {
      setToolsLoading(prev => ({ ...prev, pat: true }));
      setError('');
      
      const response = await setSendPat(bot.auth_key, patValue);
      if (response.Code === 200) {
        setShowPatModal(false);
        setPatValue('');
      } else {
        throw new Error(response.Text || '设置拍一拍失败');
      }
    } catch (error) {
      console.error('设置拍一拍失败:', error);
      setError(error instanceof Error ? error.message : '设置拍一拍失败');
    } finally {
      setToolsLoading(prev => ({ ...prev, pat: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">未找到机器人信息</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">机器人详情</h1>
          <p className="text-gray-600">查看和管理机器人的详细信息</p>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
        >
          <Trash2 size={18} className="mr-2" />
          删除机器人
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
          <AlertTriangle size={20} className="mr-2" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">基本信息</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">机器人ID</label>
                  <p className="text-gray-900">{bot.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">授权密钥</label>
                  <p className="text-gray-900">{bot.auth_key}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">botID</label>
                  <p className="text-gray-900">{bot.wxid || '未登录'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">昵称</label>
                  <p className="text-gray-900">{bot.nickname || '未设置'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">创建时间</label>
                  <p className="text-gray-900">
                    {new Date(bot.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">最后活动</label>
                  <p className="text-gray-900">
                    {bot.last_active_at ? new Date(bot.last_active_at).toLocaleString('zh-CN') : '从未活动'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-bold text-gray-800">个人资料</h2>
              {bot.status === 'online' && (
                <button
                  onClick={handleRefreshProfile}
                  disabled={refreshing}
                  className={`p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-full ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                  title="刷新资料"
                >
                  <RefreshCw size={18} />
                </button>
              )}
            </div>
            <div className="p-6">
              {profile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">用户名</label>
                    <p className="text-gray-900">{profile.username}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">昵称</label>
                    <p className="text-gray-900">{profile.nickname}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">QQ号</label>
                    <p className="text-gray-900">{profile.bind_uin || '未绑定'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">邮箱</label>
                    <p className="text-gray-900">{profile.bind_email || '未绑定'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">手机号</label>
                    <p className="text-gray-900">{profile.bind_mobile || '未绑定'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">性别</label>
                    <p className="text-gray-900">
                      {profile.sex === 1 ? '男' : profile.sex === 2 ? '女' : '未知'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">等级</label>
                    <p className="text-gray-900">{profile.level}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">经验值</label>
                    <p className="text-gray-900">{profile.experience}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {bot.status === 'online' ? (
                    <button
                      onClick={handleRefreshProfile}
                      disabled={refreshing}
                      className="text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center mx-auto"
                    >
                      <RefreshCw size={18} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                      获取用户资料
                    </button>
                  ) : (
                    '机器人未登录，无法获取资料'
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">功能配置</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link 
                  to={`/bots/keyword-replies`}
                  className="p-4 border rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                >
                  <h3 className="font-medium mb-2">关键词回复</h3>
                  <p className="text-sm text-gray-600">配置自动回复规则</p>
                </Link>
                <Link 
                  to={`/bots/plugins`}
                  className="p-4 border rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                >
                  <h3 className="font-medium mb-2">插件中心</h3>
                  <p className="text-sm text-gray-600">设置API调用规则</p>
                </Link>
                <Link 
                  to={`/bots/ai-model`}
                  className="p-4 border rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                >
                  <h3 className="font-medium mb-2">AI大模型</h3>
                  <p className="text-sm text-gray-600">配置AI对话功能</p>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">状态信息</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-center mb-6">
                {bot.avatar_url ? (
                  <img 
                    src={bot.avatar_url} 
                    alt={bot.nickname || '机器人头像'} 
                    className="w-24 h-24 rounded-full border-4 border-blue-100"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
                    <Bot size={40} className="text-gray-400" />
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">当前状态</label>
                  <div className={`flex items-center ${
                    bot.status === 'online' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
                    <span>{bot.status === 'online' ? '在线' : '离线'}</span>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <button
                    onClick={() => setShowStepModal(true)}
                    disabled={bot.status !== 'online'}
                    className={`w-full py-2 px-4 bg-blue-600 text-white rounded-md transition-colors flex items-center justify-center ${
                      bot.status !== 'online' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                    }`}
                  >
                    <Footprints size={18} className="mr-2" />
                    修改bot步数
                  </button>
                  
                  <button
                    onClick={() => setShowPatModal(true)}
                    disabled={bot.status !== 'online'}
                    className={`w-full py-2 px-4 bg-green-600 text-white rounded-md transition-colors flex items-center justify-center ${
                      bot.status !== 'online' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'
                    }`}
                  >
                    <Hand size={18} className="mr-2" />
                    设置拍一拍
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 删除确认模态框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center text-red-600 mb-4">
              <AlertTriangle size={24} className="mr-2" />
              <h3 className="text-lg font-medium">确认删除</h3>
            </div>
            <p className="text-gray-600 mb-6">
              您确定要删除这个机器人吗？此操作无法撤销，所有相关的数据都将被永久删除。
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修改步数模态框 */}
      {showStepModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">修改bot步数</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                步数 (0-99999)
              </label>
              <input
                type="number"
                min="0"
                max="99999"
                value={stepNumber}
                onChange={(e) => setStepNumber(parseInt(e.target.value) || 0)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowStepModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUpdateStepNumber}
                disabled={toolsLoading.step}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                {toolsLoading.step ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    修改中...
                  </>
                ) : (
                  '确认修改'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 设置拍一拍模态框 */}
      {showPatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">设置拍一拍</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                拍一拍文本
              </label>
              <input
                type="text"
                value={patValue}
                onChange={(e) => setPatValue(e.target.value)}
                placeholder="例如：大西瓜"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowPatModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSetSendPat}
                disabled={toolsLoading.pat}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
              >
                {toolsLoading.pat ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    设置中...
                  </>
                ) : (
                  '确认设置'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotDetailPage;