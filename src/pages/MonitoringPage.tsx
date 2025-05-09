import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bot, Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';


interface BotStatus {
  id: string;
  name: string;
  key: string;
  status: 'online' | 'offline';
  onlineTime: string;
  loginTime: string;
  statusText: string;
}

const getBotOnlineStatus = async (key: string): Promise<Omit<BotStatus, 'id' | 'name' | 'key'>> => {
  try {
    const res = await axios.get(`https://855部署的地址/login/GetLoginStatus?key=${key}`);
    if (res.data?.Code === 200 && res.data?.Data?.loginState === 1) {
      return {
        status: 'online' as const,
        onlineTime: res.data.Data.onlineTime || '',
        loginTime: res.data.Data.loginTime || '',
        statusText: res.data.Data.loginErrMsg || '账号在线状态良好！'
      };
    } else {
      return {
        status: 'offline' as const,
        onlineTime: '',
        loginTime: '',
        statusText: res.data?.Text || '账号已离线'
      };
    }
  } catch (e) {
    return {
      status: 'offline' as const,
      onlineTime: '',
      loginTime: '',
      statusText: '状态获取失败'
    };
  }
};

const MonitoringPage: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<'online' | 'partial' | 'offline'>('online');
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<{timestamp: string, type: string, message: string}[]>([]);

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      setLoading(true);
      setError('');
      // 获取机器人列表（假设有 auth_key 字段）
      const { data: bots, error: botsError } = await supabase
        .from('bots')
        .select('id, nickname, auth_key');
      if (botsError) throw botsError;

      // 并发获取每个机器人的在线状态
      const botsWithStatus: BotStatus[] = await Promise.all(
        (bots || []).map(async (bot: any) => {
          const statusInfo = await getBotOnlineStatus(bot.auth_key);
          return {
            id: bot.id,
            name: bot.nickname || `机器人 ${bot.id.slice(0, 8)}`,
            key: bot.auth_key,
            ...statusInfo
          };
        })
      );
      setBotStatuses(botsWithStatus);
    } catch (error) {
      console.error('加载监控数据失败:', error);
      setError('加载数据失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3031/wss_log');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      setLogs([]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'offline':
        return 'text-red-500';
      case 'partial':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">正常</span>;
      case 'offline':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">离线</span>;
      case 'partial':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">不稳定</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">未知</span>;
    }
  };

  useEffect(() => {
    fetchLogs(); // 初次加载立即拉取日志
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const box = document.getElementById('log-scroll-box');
    if (box) box.scrollTop = box.scrollHeight;
  }, [logs]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">系统监控</h1>
        <p className="text-gray-600">实时监控机器人运行状态和系统健康度</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden xl:col-span-2">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-gray-800">机器人状态监控</h2>
            <button 
              type="button"
              onClick={loadBots}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title="刷新数据"
            >
              <RefreshCw size={18} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">机器人</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">状态</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">在线时长</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">最后登录</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">状态说明</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {botStatuses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                      暂无机器人
                    </td>
                  </tr>
                ) : (
                  botStatuses.map((bot) => (
                    <tr key={bot.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ${bot.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                            {bot.status === 'online' ? <Wifi size={16} /> : <WifiOff size={16} />}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{bot.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {bot.status === 'online' ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">在线</span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">离线</span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                        {bot.onlineTime || '-'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                        {bot.loginTime || '-'}
                      </td>
                      <td className="px-4 py-2 max-w-xs truncate text-gray-500" title={bot.statusText}>
                        {bot.statusText}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-bold text-gray-800">系统状态</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-medium">总体状态</span>
              <div className={`flex items-center ${
                systemStatus === 'online' ? 'text-green-500' : 
                systemStatus === 'partial' ? 'text-yellow-500' : 'text-red-500'
              }`}>
                <Activity size={20} className="mr-2" />
                <span>
                  {systemStatus === 'online' ? '系统正常' : 
                   systemStatus === 'partial' ? '部分服务异常' : '系统离线'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">WebSocket服务</span>
                <span className={`flex items-center ${
                  systemStatus === 'online' ? 'text-green-500' : 
                  systemStatus === 'partial' ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    systemStatus === 'online' ? 'bg-green-500' : 
                    systemStatus === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  {systemStatus === 'online' ? '正常' : 
                   systemStatus === 'partial' ? '不稳定' : '离线'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 日志区块 */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-bold text-gray-800">运行日志</h2>
          <button
            onClick={fetchLogs}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors text-xs border border-gray-200 rounded"
            title="立即刷新日志"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr>
                <th className="px-2 py-1 border-b bg-gray-50 text-left">时间</th>
                <th className="px-2 py-1 border-b bg-gray-50 text-left">类型</th>
                <th className="px-2 py-1 border-b bg-gray-50 text-left">内容</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-gray-400 py-4">暂无日志</td>
                </tr>
              ) : (
                logs.slice(0, 100).map((log, idx) => (
                  <tr key={idx} className={log.type === 'error' ? 'bg-red-50' : ''}>
                    <td className="px-2 py-1 border-b whitespace-nowrap text-xs text-gray-500">{log.timestamp.replace('T', ' ').replace('Z', '')}</td>
                    <td className={`px-2 py-1 border-b whitespace-nowrap font-bold ${log.type === 'error' ? 'text-red-600' : 'text-blue-600'}`}>{log.type === 'info' ? '信息' : '错误'}</td>
                    <td className="px-2 py-1 border-b" style={{wordBreak: 'break-all', whiteSpace: 'pre-wrap'}}>{log.message}</td>
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

export default MonitoringPage;