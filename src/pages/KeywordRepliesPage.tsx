import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Image, MessageSquare, Mic } from 'lucide-react';
import { KeywordReply } from '../types';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { getKeywordReplies, createKeywordReply, updateKeywordReply, deleteKeywordReply } from '../services/api';
import { useAuth } from '../context/AuthContext';

const KeywordRepliesPage: React.FC = () => {
  const { user } = useAuth();
  const [replies, setReplies] = useState<KeywordReply[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingReply, setEditingReply] = useState<KeywordReply | null>(null);
  const [formData, setFormData] = useState({
    keyword: '',
    reply: '',
    reply_type: 'text' as 'text' | 'image' | 'voice',
    match_type: 'exact' as 'exact' | 'fuzzy' | 'regex',
    scope: 'all' as 'all' | 'private' | 'group',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    loadReplies();
  }, []);

  const loadReplies = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getKeywordReplies();
      setReplies(data);
    } catch (error) {
      console.error('加载关键词回复失败:', error);
      setError('加载关键词回复失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingReply) {
        await updateKeywordReply(editingReply.id, formData);
      } else {
        await createKeywordReply({
          ...formData,
          user_id: user?.id || '',
        });
      }
      await loadReplies();
      setShowAddModal(false);
      setEditingReply(null);
      setFormData({
        keyword: '',
        reply: '',
        reply_type: 'text',
        match_type: 'exact',
        scope: 'all',
        description: '',
        is_active: true,
      });
    } catch (error) {
      console.error('保存关键词回复失败:', error);
      setError('保存关键词回复失败');
    }
  };

  const handleEdit = (reply: KeywordReply) => {
    setEditingReply(reply);
    setFormData({
      keyword: reply.keyword,
      reply: reply.reply,
      reply_type: reply.reply_type,
      match_type: reply.match_type,
      scope: reply.scope,
      description: reply.description || '',
      is_active: reply.is_active,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKeywordReply(id);
      await loadReplies();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('删除关键词回复失败:', error);
      setError('删除关键词回复失败');
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setFormData(prev => ({
      ...prev,
      reply: prev.reply + emoji.native,
    }));
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setFormData(prev => ({
          ...prev,
          reply: base64
        }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('文件读取失败:', error);
      setError('文件读取失败');
    }
  };

  const getReplyTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image size={16} />;
      case 'voice':
        return <Mic size={16} />;
      default:
        return <MessageSquare size={16} />;
    }
  };

  const filteredReplies = replies.filter(reply =>
    reply.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reply.reply.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">关键词回复</h1>
          <p className="text-gray-600">管理所有机器人的自动回复规则</p>
        </div>
        <button
          onClick={() => {
            setEditingReply(null);
            setFormData({
              keyword: '',
              reply: '',
              reply_type: 'text',
              match_type: 'exact',
              scope: 'all',
              description: '',
              is_active: true,
            });
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus size={18} className="mr-2" />
          添加规则
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
          <AlertTriangle size={20} className="mr-2" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索关键词或回复内容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  关键词
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  回复内容
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  回复类型
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  匹配方式
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  发送范围
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReplies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    暂无关键词回复规则
                  </td>
                </tr>
              ) : (
                filteredReplies.map((reply) => (
                  <tr key={reply.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{reply.keyword}</div>
                      {reply.description && (
                        <div className="text-xs text-gray-500 mt-1">{reply.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {reply.reply_type === 'text' ? (
                          reply.reply
                        ) : (
                          <span className="text-gray-500">
                            {reply.reply_type === 'image' ? '[图片]' : '[语音]'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {getReplyTypeIcon(reply.reply_type)}
                        <span className="ml-1">
                          {reply.reply_type === 'text' ? '文字' : 
                           reply.reply_type === 'image' ? '图片' : '语音'}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        {reply.match_type === 'exact' ? '精确匹配' : 
                         reply.match_type === 'fuzzy' ? '模糊匹配' : '正则匹配'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                        {reply.scope === 'all' ? '全局' :
                         reply.scope === 'private' ? '私聊' : '群聊'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        reply.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {reply.is_active ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(reply)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(reply.id)}
                        className="text-red-600 hover:text-red-900"
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">
              {editingReply ? '编辑规则' : '添加新规则'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  关键词
                </label>
                <input
                  type="text"
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  回复类型
                </label>
                <select
                  value={formData.reply_type}
                  onChange={(e) => setFormData({ ...formData, reply_type: e.target.value as 'text' | 'image' | 'voice' })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">文字</option>
                  <option value="image">图片</option>
                  <option value="voice">语音</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  回复内容
                </label>
                <div className="relative">
                  {formData.reply_type === 'text' ? (
                    <>
                      <textarea
                        value={formData.reply}
                        onChange={(e) => setFormData({ ...formData, reply: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="absolute right-2 bottom-2 text-gray-500 hover:text-gray-700"
                      >
                        😊
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute bottom-full right-0 mb-2">
                          <Picker
                            data={data}
                            onEmojiSelect={handleEmojiSelect}
                            theme="light"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept={formData.reply_type === 'image' ? 'image/*' : 'audio/*'}
                        onChange={handleFileUpload}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        或直接输入{formData.reply_type === 'image' ? '图片' : '语音'}URL：
                      </p>
                      <input
                        type="text"
                        value={formData.reply}
                        onChange={(e) => setFormData({ ...formData, reply: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                        placeholder={`输入${formData.reply_type === 'image' ? '图片' : '语音'}URL`}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  匹配方式
                </label>
                <select
                  value={formData.match_type}
                  onChange={(e) => setFormData({ ...formData, match_type: e.target.value as 'exact' | 'fuzzy' | 'regex' })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="exact">精确匹配</option>
                  <option value="fuzzy">模糊匹配</option>
                  <option value="regex">正则匹配</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  发送范围
                </label>
                <select
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value as 'all' | 'private' | 'group' })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全局</option>
                  <option value="private">仅私聊</option>
                  <option value="group">仅群聊</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  规则描述
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="可选：添加规则说明"
                />
              </div>
              
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">启用规则</span>
                </label>
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingReply(null);
                    setShowEmojiPicker(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingReply ? '保存修改' : '添加规则'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center text-red-600 mb-4">
              <AlertTriangle size={24} className="mr-2" />
              <h3 className="text-lg font-medium">确认删除</h3>
            </div>
            <p className="text-gray-600 mb-6">
              您确定要删除这条规则吗？此操作无法撤销。
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeywordRepliesPage;