import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Modal, Form, Input, Select, Upload, Spin, Radio, Image, Drawer, Tabs, Typography, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RobotOutlined, UploadOutlined, SettingOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { sendFriendCircle, uploadFriendCircleImage, getAIConfigs, saveAIConfig, deleteAIConfig, generateText, generateImage, AIConfig } from '../services/api';
import dayjs from 'dayjs';
import type { UploadFile } from 'antd/es/upload/interface';

interface Moment {
  id: string;
  content: string;
  type: 'text' | 'image' | 'video';
  status: 'draft' | 'published' | 'deleted';
  publish_time: string;
  created_at: string;
  image_urls?: string[];
}

interface CustomUploadFile extends UploadFile {
  md5?: string;
  width?: number;
  height?: number;
  thumbUrl?: string;
}

const MomentsPage: React.FC = () => {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingMoment, setEditingMoment] = useState<Moment | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [fileList, setFileList] = useState<CustomUploadFile[]>([]);
  const [postType, setPostType] = useState<'text' | 'image'>('text');
  const [uploading, setUploading] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [configDrawerVisible, setConfigDrawerVisible] = useState(false);
  const [configForm] = Form.useForm();
  const [generatingImage, setGeneratingImage] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');

  useEffect(() => {
    loadMoments();
    loadAIConfig();
  }, []);

  const loadMoments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('moments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMoments(data || []);
    } catch (error) {
      message.error('加载朋友圈列表失败');
      console.error('Error loading moments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAIConfig = async () => {
    try {
      const configs = await getAIConfigs();
      if (configs.length > 0) {
        setAiConfig(configs[0]);
      }
    } catch (error) {
      message.error('加载AI配置失败');
      console.error('Error loading AI config:', error);
    }
  };

  const handleAdd = () => {
    setEditingMoment(null);
    form.resetFields();
    setFileList([]);
    setPostType('text');
    setModalVisible(true);
  };

  const handleEdit = (moment: Moment) => {
    setEditingMoment(moment);
    form.setFieldsValue({
      ...moment,
      publish_time: moment.publish_time ? dayjs(moment.publish_time) : null,
    });
    setPostType(moment.type === 'video' ? 'text' : moment.type);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('moments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      message.success('删除成功');
      loadMoments();
    } catch (error) {
      message.error('删除失败');
      console.error('Error deleting moment:', error);
    }
  };

  const handleConfigSubmit = async () => {
    try {
      const values = await configForm.validateFields();
      
      // 处理空值
      const configData = {
        base_url: values.base_url?.trim(),
        model: values.model?.trim(),
        api_key: values.api_key?.trim(),
        system_prompt: values.system_prompt?.trim() || '',
        image_base_url: values.image_base_url?.trim() || null,
        image_model: values.image_model?.trim() || null,
        image_api_key: values.image_api_key?.trim() || null
      };

      await saveAIConfig(configData);
      message.success('保存配置成功');
      setConfigDrawerVisible(false);
      loadAIConfig();
    } catch (error) {
      console.error('Error saving AI config:', error);
      message.error(error instanceof Error ? error.message : '保存配置失败');
    }
  };

  const handleConfigDelete = async (id: string) => {
    try {
      await deleteAIConfig(id);
      message.success('删除配置成功');
      loadAIConfig();
    } catch (error) {
      message.error('删除配置失败');
      console.error('Error deleting AI config:', error);
    }
  };

  const generateAIContent = async () => {
    try {
      if (!aiConfig) {
        message.error('请先配置AI服务');
        return;
      }

      if (!aiPrompt) {
        message.error('请输入创意提示词');
        return;
      }

      setAiGenerating(true);
      const content = await generateText(aiConfig, aiPrompt);
      form.setFieldsValue({ content });
    } catch (error) {
      message.error('AI生成失败');
      console.error('Error generating AI content:', error);
    } finally {
      setAiGenerating(false);
    }
  };

  const generateAIImage = async () => {
    try {
      if (!aiConfig) {
        message.error('请先配置AI服务');
        return;
      }

      if (!aiPrompt) {
        message.error('请输入创意提示词');
        return;
      }

      setGeneratingImage(true);
      const hide = message.loading('正在生成图片...');

      const imageData = await generateImage(aiConfig, aiPrompt);
      
      // 获取当前用户的在线机器人
      const { data: bots, error: botsError } = await supabase
        .from('bots')
        .select('*')
        .eq('status', 'online')
        .single();

      if (botsError || !bots) {
        throw new Error('未找到在线的机器人');
      }

      // 上传图片到朋友圈
      const response = await uploadFriendCircleImage(bots.auth_key, imageData);
      
      if (response.Code === 200 && response.Data?.[0]?.resp) {
        const imageData = response.Data[0].resp;
        const newFile: CustomUploadFile = {
          uid: `ai-${Date.now()}`,
          name: 'AI生成图片',
          status: 'done',
          url: imageData.FileURL,
          thumbUrl: imageData.ThumbURL,
          md5: imageData.ImageMD5,
          width: imageData.ImageWidth,
          height: imageData.ImageHeight,
          response: imageData // 保存完整的响应数据
        };
        setFileList(prev => [...prev, newFile]);
        hide();
        message.success('生成图片成功');
      } else {
        throw new Error(response.Text || '上传图片失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成图片失败';
      message.error(errorMessage);
      console.error('Error generating AI image:', error);
    } finally {
      setGeneratingImage(false);
    }
  };

  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return Upload.LIST_IGNORE;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过 2MB！');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result as string;
        
        // 获取当前用户的在线机器人
        const { data: bots, error: botsError } = await supabase
          .from('bots')
          .select('*')
          .eq('status', 'online')
          .single();

        if (botsError || !bots) {
          throw new Error('未找到在线的机器人');
        }

        // 上传图片
        const response = await uploadFriendCircleImage(bots.auth_key, base64Data);
        
        if (response.Code === 200) {
          const imageData = response.Data[0];
          const newFile: CustomUploadFile = {
            uid: file.name,
            name: file.name,
            status: 'done',
            url: imageData.resp.FileURL,
            thumbUrl: imageData.resp.ThumbURL,
            md5: imageData.resp.ImageMD5,
            width: imageData.resp.ImageWidth,
            height: imageData.resp.ImageHeight,
            response: imageData.resp // 保存完整的响应数据
          };
          setFileList(prev => [...prev, newFile]);
        } else {
          throw new Error(response.Text || '上传图片失败');
        }
      };
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上传图片失败');
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { content } = values;
      
      // 获取当前用户的在线机器人
      const { data: bots, error: botsError } = await supabase
        .from('bots')
        .select('*')
        .eq('status', 'online')
        .single();

      if (botsError || !bots) {
        throw new Error('未找到在线的机器人');
      }

      if (postType === 'text') {
        // 发送纯文本朋友圈
        const response = await sendFriendCircle(bots.auth_key, content);
        
        if (response.Code === 200) {
          // 保存到数据库
          const { error: dbError } = await supabase
            .from('moments')
            .insert([{
              content,
              type: 'text',
              status: 'published',
              publish_time: new Date().toISOString(),
              user_id: bots.user_id,
              bot_id: bots.id
            }]);

          if (dbError) throw dbError;
          
          message.success('发送朋友圈成功');
          setModalVisible(false);
          loadMoments();
        } else {
          throw new Error(response.Text || '发送朋友圈失败');
        }
      } else {
        // 发送图文朋友圈
        if (fileList.length === 0) {
          throw new Error('请至少上传一张图片');
        }

        // 上传图片到朋友圈
        let imageUrls = [];
        for (const file of fileList) {
          if (file.uid.startsWith('ai-')) {
            // AI生成的图片
            const imageData = file.response;
            if (!imageData) {
              throw new Error('图片数据无效');
            }
            imageUrls.push(imageData.FileURL);
          } else {
            // 普通图片
            if (!file.response) {
              throw new Error('图片数据无效');
            }
            imageUrls.push(file.response.FileURL);
          }
        }

        const mediaList = imageUrls.map((url, index) => ({
          ThumType: "1",
          Thumb: url,
          Description: "",
          Type: 2,
          MD5: "",
          SizeWidth: "800",
          VideoDuration: 0,
          UserData: "",
          VideoMD5: "",
          Title: "",
          URLType: "1",
          VideoHeight: "",
          ID: index + 1,
          SizeHeight: "800",
          TotalSize: "126335",
          URL: url,
          VideoWidth: "",
          SubType: 0,
          Private: 0
        }));

        const response = await fetch(`https://855部署的地址/sns/SendFriendCircle?key=${bots.auth_key}`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ContentStyle: 1,
            MediaList: mediaList,
            Privacy: 0,
            Content: content || ""
          })
        });

        const data = await response.json();
        
        if (data.Code === 200) {
          // 保存到数据库
          const { error: dbError } = await supabase
            .from('moments')
            .insert([{
              content,
              type: 'image',
              status: 'published',
              publish_time: new Date().toISOString(),
              image_urls: imageUrls,
              user_id: bots.user_id,
              bot_id: bots.id
            }]);

          if (dbError) throw dbError;
          
          message.success('发送朋友圈成功');
          setModalVisible(false);
          loadMoments();
        } else {
          throw new Error(data.Text || '发送朋友圈失败');
        }
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发送朋友圈失败');
      console.error('Error submitting form:', error);
    }
  };

  const columns = [
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string, record: Moment) => (
        <div>
          <div style={{ whiteSpace: 'pre-line' }}>{text}</div>
          {record.type === 'image' && record.image_urls && (
            <div style={{ marginTop: 8 }}>
              <Image.PreviewGroup>
                {record.image_urls.map((url, index) => (
                  <Image
                    key={index}
                    src={url}
                    width={100}
                    style={{ marginRight: 8 }}
                  />
                ))}
              </Image.PreviewGroup>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <span>
          {type === 'text' ? '文本' : type === 'image' ? '图文' : '视频'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span style={{ 
          color: status === 'published' ? '#52c41a' : 
                 status === 'draft' ? '#faad14' : '#ff4d4f' 
        }}>
          {status === 'published' ? '已发布' : 
           status === 'draft' ? '草稿' : '已删除'}
        </span>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'publish_time',
      key: 'publish_time',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Moment) => (
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
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="朋友圈管理"
        extra={
          <Space>
            <Tooltip title="AI配置">
              <Button
                icon={<SettingOutlined />}
                onClick={() => {
                  if (aiConfig) {
                    configForm.setFieldsValue(aiConfig);
                  }
                  setConfigDrawerVisible(true);
                }}
              />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              发送朋友圈
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={moments}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title="发送朋友圈"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          setAiPrompt('');
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item>
            <Radio.Group value={postType} onChange={(e) => setPostType(e.target.value)}>
              <Radio.Button value="text">文本</Radio.Button>
              <Radio.Button value="image">图文</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="content"
            label="朋友圈内容"
            rules={[
              { required: postType === 'text', message: '请输入朋友圈内容' },
              { min: postType === 'text' ? 1 : 0, message: '朋友圈内容不能为空' }
            ]}
          >
            <Input.TextArea rows={4} placeholder="分享你的生活点滴..." />
          </Form.Item>
          {postType === 'image' && (
            <Form.Item
              name="images"
              label="上传图片"
              rules={[{ required: true, message: '请至少上传一张图片' }]}
            >
              <Upload
                fileList={fileList}
                beforeUpload={beforeUpload}
                customRequest={({ file }) => handleUpload(file as File)}
                listType="picture-card"
                maxCount={9}
              >
                {fileList.length >= 9 ? null : (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>上传</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          )}
          <Form.Item>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input.TextArea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="输入创意提示词，例如：'帮我写一条关于春天的朋友圈文案' 或 '生成一张展现城市夜景的图片'"
                rows={2}
              />
              <Space>
                <Button
                  type="dashed"
                  icon={<RobotOutlined />}
                  onClick={generateAIContent}
                  loading={aiGenerating}
                >
                  AI创作文案
                </Button>
                {postType === 'image' && (
                  <Button
                    type="dashed"
                    icon={<RobotOutlined />}
                    onClick={generateAIImage}
                    loading={generatingImage}
                  >
                    AI生成图片
                  </Button>
                )}
              </Space>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="AI配置"
        placement="right"
        width={500}
        onClose={() => setConfigDrawerVisible(false)}
        open={configDrawerVisible}
      >
        <Form
          form={configForm}
          layout="vertical"
          onFinish={handleConfigSubmit}
        >
          <Typography.Title level={5}>文本生成配置</Typography.Title>
          <Form.Item
            name="base_url"
            label="API地址"
            rules={[
              { required: true, message: '请输入API地址' },
              { type: 'url', message: '请输入有效的URL地址' }
            ]}
          >
            <Input placeholder="例如：https://api.openai.com" />
          </Form.Item>
          <Form.Item
            name="model"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如：gpt-3.5-turbo" />
          </Form.Item>
          <Form.Item
            name="api_key"
            label="API密钥"
            rules={[{ required: true, message: '请输入API密钥' }]}
          >
            <Input.Password placeholder="请输入API密钥" />
          </Form.Item>
          <Form.Item
            name="system_prompt"
            label="系统提示词"
          >
            <Input.TextArea
              rows={4}
              placeholder="例如：你是一个专业的文案创作助手，擅长创作有趣、有吸引力的朋友圈文案。"
            />
          </Form.Item>
          <Typography.Title level={5}>图片生成配置</Typography.Title>
          <Form.Item
            name="image_base_url"
            label="图片API地址"
            rules={[
              { type: 'url', message: '请输入有效的URL地址' }
            ]}
          >
            <Input placeholder="例如：https://api.openai.com" />
          </Form.Item>
          <Form.Item
            name="image_model"
            label="图片模型名称"
          >
            <Input placeholder="例如：dall-e-3" />
          </Form.Item>
          <Form.Item
            name="image_api_key"
            label="图片API密钥"
          >
            <Input.Password placeholder="请输入图片API密钥" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default MomentsPage; 