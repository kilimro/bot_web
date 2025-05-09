import React from 'react';
import { Bot as BotIcon, Wifi, WifiOff, Clock, User, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Bot } from '../../types';

interface BotCardProps {
  bot: Bot;
  onLogin: (botId: string) => void;
  onDelete: (botId: string) => void;
}

const BotCard: React.FC<BotCardProps> = ({ bot, onLogin, onDelete }) => {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'offline':
        return 'text-red-500';
      case 'authenticating':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <Wifi className="text-green-500" size={18} />;
      case 'offline':
        return <WifiOff className="text-red-500" size={18} />;
      case 'authenticating':
        return <Clock className="text-yellow-500" size={18} />;
      default:
        return <BotIcon className="text-gray-500" size={18} />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未知';
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewDetails = () => {
    navigate(`/bots/${bot.id}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 transition-transform hover:shadow-lg hover:-translate-y-1">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <BotIcon className="text-blue-600 mr-2" size={20} />
          <h3 className="font-medium text-gray-800 truncate">
            {bot.nickname || `机器人 ${bot.id.slice(0, 8)}`}
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center">
            {getStatusIcon(bot.status)}
            <span className={`ml-1 text-sm ${getStatusColor(bot.status)}`}>
              {bot.status === 'online' ? '在线' : bot.status === 'authenticating' ? '验证中' : '离线'}
            </span>
          </div>
          <button
            onClick={() => onDelete(bot.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="删除机器人"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {bot.avatar_url && (
          <div className="mb-4 flex justify-center">
            <img 
              src={bot.avatar_url} 
              alt={bot.nickname || '机器人头像'} 
              className="w-16 h-16 rounded-full border-2 border-blue-100"
            />
          </div>
        )}
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-600">
            <span className="font-medium w-20">授权密钥:</span>
            <span className="truncate">{bot.auth_key?.slice(0, 12) || '未设置'}...</span>
          </div>
          
          {bot.wxid && (
            <div className="flex items-center text-gray-600">
              <User size={16} className="mr-1" />
              <span className="font-medium mr-2">botID:</span>
              <span>{bot.wxid}</span>
            </div>
          )}
          
          <div className="flex items-center text-gray-600">
            <Clock size={16} className="mr-1" />
            <span className="font-medium mr-2">创建时间:</span>
            <span>{formatDate(bot.created_at)}</span>
          </div>
          
          {bot.last_active_at && (
            <div className="flex items-center text-gray-600">
              <Clock size={16} className="mr-1" />
              <span className="font-medium mr-2">最后活动:</span>
              <span>{formatDate(bot.last_active_at)}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        {bot.status === 'offline' ? (
          <button
            onClick={() => onLogin(bot.id)}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            登录机器人
          </button>
        ) : (
          <div className="flex space-x-2">
            <button 
              onClick={handleViewDetails}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm"
            >
              查看详情
            </button>
            <button className="flex-1 py-2 px-3 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 text-sm">
              {bot.status === 'online' ? '下线' : '取消'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotCard;