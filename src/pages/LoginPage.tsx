import React from 'react';
import { Navigate } from 'react-router-dom';
import LoginForm from '../components/Auth/LoginForm';
import { useAuth } from '../context/AuthContext';
import { Bot as BotIcon } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 animate-gradient"></div>
      <div className="absolute inset-0 opacity-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,255,0.1),transparent_50%)] animate-pulse"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,0,255,0.1),transparent_50%)] animate-pulse delay-75"></div>
      </div>
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white bg-opacity-10 backdrop-blur-lg rounded-full shadow-lg">
              <BotIcon size={40} className="text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">bot机器人管理平台</h1>
          <p className="text-blue-200">专业的bot机器人管理与监控解决方案</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;