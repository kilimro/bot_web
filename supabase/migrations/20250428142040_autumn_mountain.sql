-- Enable pgcrypto extension if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Drop existing function first
DROP FUNCTION IF EXISTS authenticate_user(text, text);

-- 创建认证函数
CREATE FUNCTION authenticate_user(
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

-- Add initial user with correct credentials
DELETE FROM users WHERE email = 'haige@qq.com';
INSERT INTO users (email, password_hash)
VALUES ('haige@qq.com', crypt('admin123', gen_salt('bf')));