import React, { useState, useEffect } from 'react';
import { Bot, Activity, Users, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalBots: 0,
    onlineBots: 0,
    offlineBots: 0,
    messagesHandled: 0,
  });
  const [recentEvents, setRecentEvents] = useState<{
    id: string;
    event: string;
    time: string;
    status: 'success' | 'warning' | 'error' | 'info';
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
    
    // 订阅实时更新
    const botsSubscription = supabase
      .channel('bots-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bots'
      }, () => {
        loadDashboardData();
      })
      .subscribe();

    const eventsSubscription = supabase
      .channel('events-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bot_events'
      }, () => {
        loadRecentEvents();
      })
      .subscribe();

    return () => {
      botsSubscription.unsubscribe();
      eventsSubscription.unsubscribe();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // 获取机器人统计数据
      const [
        { count: totalBots },
        { count: onlineBots },
        { count: offlineBots },
        { count: messagesHandled }
      ] = await Promise.all([
        supabase.from('bots').select('*', { count: 'exact' }),
        supabase.from('bots').select('*', { count: 'exact' }).eq('status', 'online'),
        supabase.from('bots').select('*', { count: 'exact' }).eq('status', 'offline'),
        supabase.from('bot_messages').select('*', { count: 'exact' })
      ]);

      setStats({
        totalBots: totalBots || 0,
        onlineBots: onlineBots || 0,
        offlineBots: offlineBots || 0,
        messagesHandled: messagesHandled || 0,
      });

      await loadRecentEvents();
    } catch (error) {
      console.error('加载数据失败:', error);
      setError('加载数据失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentEvents = async () => {
    try {
      const { data: events, error: eventsError } = await supabase
        .from('bot_events')
        .select(`
          id,
          event_type,
          message,
          created_at,
          bots (
            nickname
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (eventsError) throw eventsError;

      const formattedEvents = events.map(event => ({
        id: event.id,
        event: `${event.bots?.nickname || '未知机器人'} - ${event.message}`,
        time: new Date(event.created_at).toLocaleString('zh-CN'),
        status: event.event_type as 'success' | 'warning' | 'error' | 'info'
      }));

      setRecentEvents(formattedEvents);
    } catch (error) {
      console.error('加载最近活动失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'info':
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const statCards = [
    {
      title: '总机器人数',
      value: stats.totalBots,
      icon: <Bot size={24} className="text-blue-600" />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      link: '/bots',
    },
    {
      title: '在线机器人',
      value: stats.onlineBots,
      icon: <Activity size={24} className="text-green-600" />,
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      link: '/bots?status=online',
    },
    {
      title: '离线机器人',
      value: stats.offlineBots,
      icon: <Clock size={24} className="text-red-600" />,
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      link: '/bots?status=offline',
    },
    {
      title: '总消息处理量',
      value: stats.messagesHandled,
      icon: <Users size={24} className="text-purple-600" />,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      link: '/monitoring',
    },
  ];

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
        <h1 className="text-2xl font-bold text-gray-800 mb-2">控制面板</h1>
        <p className="text-gray-600">查看您的机器人运行状态和统计数据</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => (
          <Link to={card.link} key={index} className="block">
            <div className={`p-6 rounded-lg shadow-sm border border-gray-200 ${card.bgColor} hover:shadow-md transition-shadow`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`font-medium ${card.textColor}`}>{card.title}</h3>
                {card.icon}
              </div>
              <p className="text-3xl font-bold text-gray-800">{card.value}</p>
            </div>
          </Link>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-bold text-gray-800">最近活动</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentEvents.length === 0 ? (
              <div className="px-6 py-4 text-center text-gray-500">
                暂无活动记录
              </div>
            ) : (
              recentEvents.map((activity) => (
                <div key={activity.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(activity.status)} mr-2`}>
                      {activity.status === 'success' ? '成功' : 
                       activity.status === 'warning' ? '警告' : 
                       activity.status === 'error' ? '错误' : '信息'}
                    </span>
                    <span>{activity.event}</span>
                  </div>
                  <span className="text-sm text-gray-500">{activity.time}</span>
                </div>
              ))
            )}
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-right">
            <Link to="/monitoring" className="text-sm text-blue-600 hover:text-blue-800">
              查看全部活动 &rarr;
            </Link>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-bold text-gray-800">快速操作</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link to="/bots" className="block p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Bot size={24} className="mb-2" />
                <h3 className="font-bold mb-1">新建机器人</h3>
                <p className="text-sm text-blue-100">创建并配置新机器人</p>
              </Link>
              <Link to="/auth-keys/new" className="block p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                <Activity size={24} className="mb-2" />
                <h3 className="font-bold mb-1">生成授权密钥</h3>
                <p className="text-sm text-indigo-100">创建新的授权密钥</p>
              </Link>
              <Link to="/monitoring" className="block p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                <Activity size={24} className="mb-2" />
                <h3 className="font-bold mb-1">查看监控</h3>
                <p className="text-sm text-green-100">实时监控机器人状态</p>
              </Link>
              <Link to="/settings" className="block p-4 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors">
                <Clock size={24} className="mb-2" />
                <h3 className="font-bold mb-1">系统设置</h3>
                <p className="text-sm text-gray-300">配置系统参数</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;