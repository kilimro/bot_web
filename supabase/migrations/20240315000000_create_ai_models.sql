-- 创建 AI 模型配置表
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    name TEXT NOT NULL,
    model TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    trigger_prefix TEXT NOT NULL,
    block_list TEXT[] DEFAULT ARRAY['wexin'],
    send_type TEXT NOT NULL CHECK (send_type IN ('all', 'private', 'group')),
    group_whitelist TEXT[] DEFAULT ARRAY['all'],
    enable_split_send BOOLEAN DEFAULT true,
    split_send_interval INTEGER DEFAULT 3000,
    reply_probability INTEGER DEFAULT 100 CHECK (reply_probability BETWEEN 1 AND 100),
    context_count INTEGER DEFAULT 0 CHECK (context_count BETWEEN 0 AND 20),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_models_user_id ON ai_models(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_models_enabled ON ai_models(enabled);

-- 启用行级安全
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "用户可以查看自己的AI模型配置"
    ON ai_models FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "用户可以创建自己的AI模型配置"
    ON ai_models FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以更新自己的AI模型配置"
    ON ai_models FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的AI模型配置"
    ON ai_models FOR DELETE
    USING (auth.uid() = user_id);

-- 创建更新触发器
CREATE OR REPLACE FUNCTION update_ai_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_models_updated_at
    BEFORE UPDATE ON ai_models
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_models_updated_at();

-- 添加注释
COMMENT ON TABLE ai_models IS '存储用户的AI模型配置';
COMMENT ON COLUMN ai_models.id IS '唯一标识符';
COMMENT ON COLUMN ai_models.enabled IS '是否启用该模型';
COMMENT ON COLUMN ai_models.name IS '模型名称';
COMMENT ON COLUMN ai_models.model IS '模型标识符（如 gpt-3.5-turbo）';
COMMENT ON COLUMN ai_models.base_url IS 'API基础地址';
COMMENT ON COLUMN ai_models.api_key IS 'API密钥';
COMMENT ON COLUMN ai_models.system_prompt IS '系统提示词';
COMMENT ON COLUMN ai_models.trigger_prefix IS '触发前缀';
COMMENT ON COLUMN ai_models.block_list IS '屏蔽名单';
COMMENT ON COLUMN ai_models.send_type IS '发送类型（all/private/group）';
COMMENT ON COLUMN ai_models.group_whitelist IS '群聊白名单';
COMMENT ON COLUMN ai_models.enable_split_send IS '是否启用分段发送';
COMMENT ON COLUMN ai_models.split_send_interval IS '分段发送间隔（毫秒）';
COMMENT ON COLUMN ai_models.reply_probability IS '回复概率（1-100）';
COMMENT ON COLUMN ai_models.context_count IS '上下文消息数量（0-20）';
COMMENT ON COLUMN ai_models.user_id IS '关联的用户ID';
COMMENT ON COLUMN ai_models.created_at IS '创建时间';
COMMENT ON COLUMN ai_models.updated_at IS '更新时间'; 