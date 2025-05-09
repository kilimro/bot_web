import React, { useState } from 'react';
import { getLoginQrCode, checkLoginStatus, updateBot } from '../../services/api';
import { X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { LoginStatusResponse } from '../../types';

interface QrCodeLoginProps {
  authKey: string;
  botId: string;
  onClose: () => void;
  onLoginSuccess: (data: LoginStatusResponse['Data']) => void;
}

const QrCodeLogin: React.FC<QrCodeLoginProps> = ({ authKey, botId, onClose, onLoginSuccess }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [checking, setChecking] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const loadQrCode = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getLoginQrCode(authKey);
      if (response.Code === 200 && response.Data.QrCodeUrl) {
        setQrCodeUrl(response.Data.QrCodeUrl);
      } else {
        setError('获取二维码失败: ' + (response.Text || '未知错误'));
      }
    } catch (err) {
      setError('获取二维码时发生错误');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (checking) return;

    try {
      setChecking(true);
      setStatusMessage('正在检查登录状态...');
      
      const response = await checkLoginStatus(authKey);
      
      if (response.Code === 200) {
        if (response.Data.state === 2) { // 登录成功
          // 更新机器人状态
          await updateBot(botId, {
            status: 'online',
            wxid: response.Data.wxid,
            nickname: response.Data.nick_name,
            avatar_url: response.Data.head_img_url,
            last_active_at: new Date().toISOString()
          });

          setStatusMessage('登录成功！');
          setTimeout(() => {
            onLoginSuccess(response.Data);
          }, 1500);
        } else if (response.Data.state === 1) {
          setStatusMessage('已扫码，等待确认...');
          setChecking(false);
        } else {
          setStatusMessage('请扫描二维码');
          setChecking(false);
        }
      } else {
        setStatusMessage('检查登录状态失败: ' + (response.Text || '未知错误'));
        setChecking(false);
      }
    } catch (err) {
      setStatusMessage('检查登录状态时发生错误');
      setChecking(false);
      console.error(err);
    }
  };

  React.useEffect(() => {
    loadQrCode();
  }, [authKey]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden animate-fade-in">
        <div className="bg-blue-800 text-white px-4 py-3 flex justify-between items-center">
          <h3 className="font-medium">bot机器人登录</h3>
          <button 
            onClick={onClose} 
            className="text-white hover:text-gray-200 focus:outline-none"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
              <p className="mt-4 text-gray-600">正在加载二维码...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={loadQrCode}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <RefreshCw size={16} className="mr-2" />
                重新加载
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-4 text-gray-700">请使用bot扫描以下二维码登录</p>
              <div className="mb-6 flex justify-center">
                <img 
                  src={qrCodeUrl} 
                  alt="bot登录二维码" 
                  className="max-w-full h-auto border p-2 rounded-lg shadow-sm" 
                  style={{ maxWidth: '200px' }}
                />
              </div>
              
              {statusMessage && (
                <div className={`mb-4 p-2 rounded ${
                  statusMessage.includes('成功') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {statusMessage.includes('成功') && <CheckCircle2 size={16} className="inline mr-1" />}
                  {statusMessage}
                </div>
              )}

              <button
                onClick={checkStatus}
                disabled={checking}
                className={`w-full py-2 px-4 bg-blue-600 text-white rounded-md transition-colors ${
                  checking ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
                }`}
              >
                {checking ? '检查中...' : '已完成扫码登录'}
              </button>
              
              <p className="mt-4 text-sm text-gray-500">
                扫码后，请在手机上点击确认登录
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrCodeLogin;