import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await login(email, password);
      setSuccess('登录成功！正在跳转...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登录失败，请检查邮箱和密码';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="bg-white bg-opacity-10 backdrop-blur-lg shadow-lg rounded-lg px-8 pt-6 pb-8 mb-4 border border-white border-opacity-20">
        {error && (
          <div className="mb-4 p-3 bg-red-500 bg-opacity-20 backdrop-blur-lg text-red-100 rounded-md flex items-center">
            <AlertCircle size={16} className="mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500 bg-opacity-20 backdrop-blur-lg text-green-100 rounded-md flex items-center">
            <CheckCircle2 size={16} className="mr-2 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}
        
        <div className="mb-6">
          <label className="block text-blue-100 text-sm font-bold mb-2" htmlFor="email">
            邮箱
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-3 px-4 bg-white bg-opacity-10 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-opacity-20 placeholder-blue-200 placeholder-opacity-50"
              placeholder="请输入邮箱"
              required
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
        
        <div className="mb-8">
          <label className="block text-blue-100 text-sm font-bold mb-2" htmlFor="password">
            密码
          </label>
          <div className="relative">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-3 px-4 bg-white bg-opacity-10 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-opacity-20 placeholder-blue-200 placeholder-opacity-50"
              placeholder="请输入密码"
              required
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse delay-75"></div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center backdrop-blur-lg transform transition-all duration-150 hover:scale-[1.02] ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                登录中...
              </span>
            ) : (
              <span className="flex items-center">
                <LogIn size={18} className="mr-2" />
                登录
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;