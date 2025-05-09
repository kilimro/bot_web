-- 删除已存在的表（如果存在）
DROP TABLE IF EXISTS auth_keys CASCADE;

-- 创建授权密钥表
CREATE TABLE auth_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX idx_auth_keys_user_id ON auth_keys(user_id);
CREATE INDEX idx_auth_keys_key ON auth_keys(key);
CREATE INDEX idx_auth_keys_expires_at ON auth_keys(expires_at);

-- 授予基本权限
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON auth_keys TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- 启用行级安全
ALTER TABLE auth_keys ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "用户可以管理自己的授权密钥"
    ON auth_keys
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "管理员可以管理所有授权密钥"
    ON auth_keys
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- 添加注释
COMMENT ON TABLE auth_keys IS '存储用户的授权密钥';
COMMENT ON COLUMN auth_keys.id IS '唯一标识符';
COMMENT ON COLUMN auth_keys.key IS '授权密钥';
COMMENT ON COLUMN auth_keys.user_id IS '关联的用户ID';
COMMENT ON COLUMN auth_keys.created_at IS '创建时间';
COMMENT ON COLUMN auth_keys.updated_at IS '更新时间';
COMMENT ON COLUMN auth_keys.expires_at IS '过期时间';
COMMENT ON COLUMN auth_keys.is_used IS '是否已使用';
COMMENT ON COLUMN auth_keys.created_by IS '创建者ID';

-- 创建触发器函数，用于自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_auth_keys_updated_at
    BEFORE UPDATE ON auth_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 