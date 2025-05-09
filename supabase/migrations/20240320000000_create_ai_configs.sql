-- 删除现有表（如果存在）
DROP TABLE IF EXISTS public.ai_configs CASCADE;

-- 创建ai_configs表
CREATE TABLE public.ai_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    base_url TEXT NOT NULL,
    model TEXT NOT NULL,
    api_key TEXT NOT NULL,
    system_prompt TEXT,
    image_base_url TEXT,
    image_model TEXT,
    image_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 启用行级安全策略
ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "用户可以查看自己的AI配置" ON public.ai_configs;
DROP POLICY IF EXISTS "用户可以创建自己的AI配置" ON public.ai_configs;
DROP POLICY IF EXISTS "用户可以更新自己的AI配置" ON public.ai_configs;
DROP POLICY IF EXISTS "用户可以删除自己的AI配置" ON public.ai_configs;

-- 创建新的策略
CREATE POLICY "用户可以查看自己的AI配置"
    ON public.ai_configs
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "用户可以创建自己的AI配置"
    ON public.ai_configs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以更新自己的AI配置"
    ON public.ai_configs
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的AI配置"
    ON public.ai_configs
    FOR DELETE
    USING (auth.uid() = user_id);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_configs_user_id ON public.ai_configs(user_id);

-- 删除现有触发器（如果存在）
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_configs;
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- 创建更新时间的触发器函数
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.ai_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 授予权限
GRANT ALL ON public.ai_configs TO authenticated;
GRANT ALL ON public.ai_configs TO service_role; 