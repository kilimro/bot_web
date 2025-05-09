import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { importBot } from '@/services/api';

interface ImportBotFormProps {
  onSuccess?: () => void;
}

const ImportBotForm: React.FC<ImportBotFormProps> = ({ onSuccess }) => {
  const [authKey, setAuthKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await importBot(authKey);
      setAuthKey('');
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '导入失败，请稍后重试';
      setError(errorMessage);
      console.error('Import error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center text-red-700">
            <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="authKey" className="block text-sm font-medium text-gray-700 mb-1">
          授权密钥
        </label>
        <input
          type="text"
          id="authKey"
          value={authKey}
          onChange={(e) => setAuthKey(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="输入机器人授权密钥"
          required
        />
        <p className="mt-2 text-sm text-gray-500">
          请确保机器人已在其他设备上登录并处于在线状态
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            导入中...
          </>
        ) : (
          '导入机器人'
        )}
      </button>
    </form>
  );
};

export default ImportBotForm;