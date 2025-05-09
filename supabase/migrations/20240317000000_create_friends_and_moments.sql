-- 删除旧表（如果存在）
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS moments CASCADE;

-- 创建好友表
CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    wx_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    remark TEXT,
    sex INTEGER,
    province TEXT,
    city TEXT,
    signature TEXT,
    alias TEXT,
    country TEXT,
    avatar_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(wx_id, user_id)
);

-- 创建朋友圈表
CREATE TABLE IF NOT EXISTS moments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'deleted')),
    publish_time TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS friends_user_id_idx ON friends(user_id);
CREATE INDEX IF NOT EXISTS friends_wx_id_idx ON friends(wx_id);
CREATE INDEX IF NOT EXISTS friends_status_idx ON friends(status);
CREATE INDEX IF NOT EXISTS moments_user_id_idx ON moments(user_id);
CREATE INDEX IF NOT EXISTS moments_status_idx ON moments(status);
CREATE INDEX IF NOT EXISTS moments_publish_time_idx ON moments(publish_time);

-- 启用行级安全
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "用户只能查看自己的好友" ON friends
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户只能管理自己的好友" ON friends
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "用户只能查看自己的朋友圈" ON moments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户只能管理自己的朋友圈" ON moments
    FOR ALL USING (auth.uid() = user_id);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_friends_updated_at
    BEFORE UPDATE ON friends
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_moments_updated_at
    BEFORE UPDATE ON moments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE friends IS '好友管理表';
COMMENT ON COLUMN friends.id IS '好友ID';
COMMENT ON COLUMN friends.user_id IS '关联用户ID';
COMMENT ON COLUMN friends.wx_id IS '微信ID';
COMMENT ON COLUMN friends.nickname IS '好友昵称';
COMMENT ON COLUMN friends.remark IS '好友备注';
COMMENT ON COLUMN friends.sex IS '性别：1-男，2-女';
COMMENT ON COLUMN friends.province IS '省份';
COMMENT ON COLUMN friends.city IS '城市';
COMMENT ON COLUMN friends.signature IS '个性签名';
COMMENT ON COLUMN friends.alias IS '微信号';
COMMENT ON COLUMN friends.country IS '国家';
COMMENT ON COLUMN friends.avatar_url IS '头像URL';
COMMENT ON COLUMN friends.status IS '好友状态：active-活跃，inactive-不活跃';
COMMENT ON COLUMN friends.created_at IS '创建时间';
COMMENT ON COLUMN friends.updated_at IS '更新时间';

COMMENT ON TABLE moments IS '朋友圈管理表';
COMMENT ON COLUMN moments.id IS '动态ID';
COMMENT ON COLUMN moments.content IS '动态内容';
COMMENT ON COLUMN moments.type IS '动态类型：text-文本，image-图片，video-视频';
COMMENT ON COLUMN moments.status IS '动态状态：draft-草稿，published-已发布，deleted-已删除';
COMMENT ON COLUMN moments.publish_time IS '发布时间';
COMMENT ON COLUMN moments.user_id IS '关联用户ID';
COMMENT ON COLUMN moments.created_at IS '创建时间';
COMMENT ON COLUMN moments.updated_at IS '更新时间'; 