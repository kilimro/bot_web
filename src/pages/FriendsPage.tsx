import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Modal, Form, Input, Select, Avatar, Tag, InputRef } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { getFriendList, Friend, delContact, modifyRemark } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { ColumnType } from 'antd/es/table';
import type { FilterConfirmProps } from 'antd/es/table/interface';

interface StoredFriend {
  id: string;
  user_id: string;
  wx_id: string;
  nickname: string;
  remark: string;
  sex: number;
  province: string;
  city: string;
  signature: string;
  alias: string;
  country: string;
  avatar_url: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

const FriendsPage: React.FC = () => {
  const [friends, setFriends] = useState<StoredFriend[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingFriend, setEditingFriend] = useState<StoredFriend | null>(null);
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = React.useRef<InputRef>(null);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      // 从 Supabase 加载已存储的好友数据
      const { data: storedFriends, error } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFriends(storedFriends || []);
    } catch (error) {
      message.error('加载好友列表失败');
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncFriends = async () => {
    try {
      setLoading(true);
      
      console.log('开始同步好友列表，当前用户ID:', user?.id);
      
      // 获取当前用户的机器人列表
      const { data: bots, error: botsError } = await supabase
        .from('bots')
        .select('id, auth_key')
        .eq('user_id', user?.id)
        .eq('status', 'online')
        .single();

      console.log('查询机器人结果:', { bots, botsError });

      if (botsError || !bots) {
        throw new Error('未找到在线的机器人');
      }

      console.log('找到在线机器人，authKey:', bots.auth_key);

      // 获取最新的好友列表
      const response = await getFriendList(bots.auth_key);
      
      console.log('获取好友列表响应:', response);

      if (response.Code !== 200) {
        throw new Error(response.Text || '获取好友列表失败');
      }

      // 转换数据格式并存储到 Supabase
      const friendsToStore = response.Data.friendList.map(friend => ({
        user_id: user?.id,
        wx_id: friend.userName.str,
        nickname: friend.nickName.str,
        remark: '',
        sex: friend.sex,
        province: friend.province,
        city: friend.city,
        signature: friend.signature,
        alias: friend.alias,
        country: friend.country,
        avatar_url: friend.bigHeadImgUrl,
        status: 'active' as const
      }));

      console.log('准备存储的好友数据:', friendsToStore);

      // 批量插入或更新好友数据
      const { error: upsertError } = await supabase
        .from('friends')
        .upsert(friendsToStore, {
          onConflict: 'wx_id,user_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('存储好友数据失败:', upsertError);
        throw upsertError;
      }
      
      message.success('同步好友列表成功');
      loadFriends();
    } catch (error) {
      console.error('同步好友列表失败:', error);
      message.error(error instanceof Error ? error.message : '同步好友列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (friend: StoredFriend) => {
    setEditingFriend(friend);
    form.setFieldsValue(friend);
    setModalVisible(true);
  };

  const handleDelete = async (id: string, wxId: string) => {
    try {
      // 获取当前用户的机器人
      const { data: bots, error: botsError } = await supabase
        .from('bots')
        .select('id, auth_key')
        .eq('user_id', user?.id)
        .eq('status', 'online')
        .single();

      if (botsError || !bots) {
        throw new Error('未找到在线的机器人');
      }

      // 调用 API 删除好友
      const response = await delContact(bots.auth_key, wxId);
      
      if (response.Code !== 200) {
        throw new Error(response.Text || '删除好友失败');
      }

      // 从数据库中删除记录
      const { error: deleteError } = await supabase
        .from('friends')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      message.success('删除成功');
      loadFriends();
    } catch (error) {
      console.error('删除好友失败:', error);
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (!editingFriend) return;

      // 获取当前用户的机器人
      const { data: bots, error: botsError } = await supabase
        .from('bots')
        .select('id, auth_key')
        .eq('user_id', user?.id)
        .eq('status', 'online')
        .single();

      if (botsError || !bots) {
        throw new Error('未找到在线的机器人');
      }

      // 如果修改了备注，先调用 API 修改
      if (values.remark !== editingFriend.remark) {
        const response = await modifyRemark(bots.auth_key, editingFriend.wx_id, values.remark);
        
        if (response.Code !== 200) {
          throw new Error(response.Text || '修改备注失败');
        }
      }

      // 更新数据库记录
      const { error: updateError } = await supabase
        .from('friends')
        .update(values)
        .eq('id', editingFriend.id);

      if (updateError) throw updateError;

      message.success('更新成功');
      setModalVisible(false);
      loadFriends();
    } catch (error) {
      console.error('更新好友信息失败:', error);
      message.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  const handleSearch = (
    selectedKeys: string[],
    confirm: (param?: FilterConfirmProps) => void,
    dataIndex: string,
  ) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters: () => void) => {
    clearFilters();
    setSearchText('');
  };

  const getColumnSearchProps = (dataIndex: keyof StoredFriend): ColumnType<StoredFriend> => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
      <div style={{ padding: 8 }}>
        <Input
          ref={searchInput}
          placeholder={`搜索 ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys as string[], confirm, dataIndex)}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys as string[], confirm, dataIndex)}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            搜索
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            重置
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
    ),
    onFilter: (value, record) =>
      record[dataIndex]
        ? record[dataIndex].toString().toLowerCase().includes(value.toString().toLowerCase())
        : false,
    onFilterDropdownVisibleChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
  });

  const columns = [
    {
      title: '头像',
      dataIndex: 'avatar_url',
      key: 'avatar_url',
      render: (url: string) => (
        <Avatar src={url} size="large" />
      ),
    },
    {
      title: 'botID',
      dataIndex: 'wx_id',
      key: 'wx_id',
      ...getColumnSearchProps('wx_id'),
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      ...getColumnSearchProps('nickname'),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ...getColumnSearchProps('remark'),
    },
    {
      title: '性别',
      dataIndex: 'sex',
      key: 'sex',
      render: (sex: number) => (
        <Tag color={sex === 1 ? 'blue' : 'pink'}>
          {sex === 1 ? '男' : sex === 2 ? '女' : '未知'}
        </Tag>
      ),
    },
    {
      title: '地区',
      key: 'location',
      render: (_: any, record: StoredFriend) => (
        <span>{record.province} {record.city}</span>
      ),
    },
    {
      title: '个性签名',
      dataIndex: 'signature',
      key: 'signature',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '活跃' : '不活跃'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: StoredFriend) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.wx_id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>好友管理</span>
            <div style={{ display: 'flex', gap: '8px', fontSize: '14px', color: '#666' }}>
              <span>总人数: {friends.length}</span>
              <span>|</span>
              <span>男性: {friends.filter(f => f.sex === 1).length}</span>
              <span>|</span>
              <span>女性: {friends.filter(f => f.sex === 2).length}</span>
              <span>|</span>
              <span>未知: {friends.filter(f => f.sex !== 1 && f.sex !== 2).length}</span>
            </div>
          </div>
        }
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={syncFriends}
              loading={loading}
            >
              同步好友
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={friends}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title="编辑好友"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="remark"
            label="备注"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value="active">活跃</Select.Option>
              <Select.Option value="inactive">不活跃</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FriendsPage; 