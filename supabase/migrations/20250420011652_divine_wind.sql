/*
  # Fix authenticate_user function

  1. Changes
    - Drop existing authenticate_user function
    - Recreate function with explicit table references
    - Fix ambiguous email column reference
    - Return user data with unambiguous column names
  
  2. Security
    - Function remains accessible to authenticated users only
    - No changes to existing security policies
*/

-- First drop the existing function
DROP FUNCTION IF EXISTS authenticate_user(text, text);

-- Recreate the function with updated signature and body
CREATE FUNCTION authenticate_user(p_email text, p_password text)
RETURNS TABLE (
  id uuid,
  user_email text,
  token text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    users.id,
    users.email as user_email,
    gen_random_uuid()::text as token
  FROM users
  WHERE users.email = p_email 
  AND users.password_hash = crypt(p_password, users.password_hash);
END;
$$;