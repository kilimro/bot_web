/*
  # 创建用户认证表和函数

  1. 新建表
    - `users`
      - `id` (uuid, 主键)
      - `email` (text, 唯一)
      - `password_hash` (text)
      - `created_at` (timestamp)
      - `last_login` (timestamp)
      - `is_active` (boolean)

  2. 安全
    - 启用RLS
    - 添加用户认证策略
*/

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_login timestamptz,
  is_active boolean DEFAULT true
);

-- 启用RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 创建认证函数
CREATE OR REPLACE FUNCTION authenticate_user(
  p_email text,
  p_password text
) RETURNS TABLE (
  user_id uuid,
  email text,
  token text
) AS $$
DECLARE
  v_user users%ROWTYPE;
  v_token text;
BEGIN
  -- 查找用户
  SELECT * INTO v_user
  FROM users
  WHERE email = p_email 
  AND password_hash = crypt(p_password, password_hash)
  AND is_active = true;

  IF v_user.id IS NOT NULL THEN
    -- 更新最后登录时间
    UPDATE users 
    SET last_login = now() 
    WHERE id = v_user.id;

    -- 生成token
    v_token := encode(gen_random_bytes(32), 'base64');

    RETURN QUERY
    SELECT 
      v_user.id,
      v_user.email,
      v_token;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加初始用户
INSERT INTO users (email, password_hash)
VALUES ('haige@qq.com', crypt('admin123', gen_salt('bf')))
ON CONFLICT (email) DO NOTHING;