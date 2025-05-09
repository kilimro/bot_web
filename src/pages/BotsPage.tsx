import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCw, AlertTriangle, Import, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BotCard from '../components/Bot/BotCard';
import QrCodeLogin from '../components/Bot/QrCodeLogin';
import ImportBotForm from '../components/Bot/ImportBotForm';
import { Bot, LoginStatusResponse } from '../types';
import { getBotList, generateAuthKey, createBot, deleteBot } from '../services/api';
import { supabase } from '../lib/supabase';

interface QrCodeLoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const QrCodeLoginModal: React.FC<QrCodeLoginModalProps> = ({ onClose, onSuccess }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [authKey, setAuthKey] = useState<string>('');
  const [status, setStatus] = useState<string>('正在生成授权码...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    initLogin();
  }, []);

  const initLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // 1. 生成授权码
      const keyResponse = await generateAuthKey();
      if (keyResponse.Code !== 200) {
        throw new Error(keyResponse.Text || '生成授权码失败');
      }
      const newAuthKey = keyResponse.Data[0];
      setAuthKey(newAuthKey);
      setStatus('正在获取登录二维码...');

      // 2. 获取登录二维码
      const qrResponse = await fetch('https://855部署的地址/login/GetLoginQrCodeNewX?key=' + newAuthKey, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Check: false,
          Proxy: ''
        })
      });
      const qrData = await qrResponse.json();
      if (qrData.Code !== 200) {
        throw new Error(qrData.Text || '获取二维码失败');
      }
      setQrCodeUrl(qrData.Data.QrCodeUrl);
      setStatus('请使用bot扫描二维码登录');
      setIsLoading(false);
      setIsScanning(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : '初始化登录失败');
      setIsLoading(false);
    }
  };

  const handleConfirmScan = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 3. 检查扫码状态
      const response = await fetch('https://855部署的地址/login/CheckLoginStatus?key=' + authKey);
      const data = await response.json();
      
      if (data.Code !== 200 || data.Data.state !== 2) {
        throw new Error('请先完成扫码登录');
      }

      // 4. 检查在线状态
      const statusResponse = await fetch('https://855部署的地址/login/GetLoginStatus?key=' + authKey);
      const statusData = await statusResponse.json();
      if (statusData.Code !== 200 || statusData.Data.loginState !== 1) {
        throw new Error('机器人未在线');
      }

      // 5. 获取机器人资料
      const profileResponse = await fetch('https://855部署的地址/user/GetProfile?key=' + authKey);
      const profileData = await profileResponse.json();
      if (profileData.Code !== 200) {
        throw new Error('获取机器人资料失败');
      }

      // 保存机器人信息到数据库
      const { data: bot, error: createError } = await supabase
        .from('bots')
        .insert([{
          auth_key: authKey,
          wxid: data.Data.wxid,
          nickname: profileData.Data.userInfo.nickName.str,
          avatar_url: profileData.Data.userInfoExt.bigHeadImgUrl,
          status: 'online',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) {
        throw new Error('保存机器人信息失败: ' + createError.message);
      }

      onSuccess();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : '确认登录失败');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">新建机器人</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>

        {error ? (
          <div className="text-center py-8">
            <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={initLogin}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              重试
            </button>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{status}</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <img src={qrCodeUrl} alt="登录二维码" className="mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{status}</p>
            {isScanning && (
              <button
                onClick={handleConfirmScan}
                className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 mx-auto"
              >
                <Check className="mr-2" size={18} />
                已扫码确认
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const BotsPage: React.FC = () => {
  const [showImportForm, setShowImportForm] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingBot, setIsCreatingBot] = useState(false);
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const botsList = await getBotList();
      setBots(botsList);
    } catch (err) {
      setError('Failed to load bots. Please try again later.');
      console.error('Error fetching bots:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (botId: string) => {
    // TODO: 实现登录逻辑
    console.log('Login bot:', botId);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">机器人管理</h1>
          <p className="text-gray-600">管理您的所有bot机器人</p>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowImportForm(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Import size={18} className="mr-2" />
            导入机器人
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={isCreatingBot}
            className={`flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
              isCreatingBot ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isCreatingBot ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                创建中...
              </>
            ) : (
              <>
                <Plus size={18} className="mr-2" />
                新建机器人
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex items-center">
            <AlertTriangle className="text-red-500 mr-2" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">还没有机器人，立即创建或导入一个吧！</p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} className="mr-2" />
              新建机器人
            </button>
            <button
              onClick={() => setShowImportForm(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Import size={18} className="mr-2" />
              导入机器人
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <BotCard 
              key={bot.id} 
              bot={bot} 
              onDelete={fetchBots}
              onLogin={handleLogin}
            />
          ))}
        </div>
      )}

      {showImportForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">导入现有机器人</h3>
              <button
                onClick={() => setShowImportForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            <ImportBotForm onSuccess={() => {
              setShowImportForm(false);
              fetchBots();
            }} />
          </div>
        </div>
      )}

      {showCreateModal && (
        <QrCodeLoginModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchBots}
        />
      )}
    </div>
  );
};

export default BotsPage;