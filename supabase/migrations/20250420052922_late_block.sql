/*
  # Add bot profiles table

  1. New Tables
    - `bot_profiles`
      - `id` (uuid, primary key)
      - `bot_id` (uuid, foreign key)
      - `username` (text)
      - `nickname` (text)
      - `bind_uin` (bigint)
      - `bind_email` (text)
      - `bind_mobile` (text)
      - `sex` (integer)
      - `level` (integer)
      - `experience` (integer)
      - `alias` (text)
      - `big_head_img_url` (text)
      - `small_head_img_url` (text)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create table
CREATE TABLE IF NOT EXISTS bot_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  username text,
  nickname text,
  bind_uin bigint,
  bind_email text,
  bind_mobile text,
  sex integer,
  level integer,
  experience integer,
  alias text,
  big_head_img_url text,
  small_head_img_url text,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT bot_profiles_bot_id_key UNIQUE (bot_id)
);

-- Enable RLS
ALTER TABLE bot_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view profiles for their bots" ON bot_profiles;
  DROP POLICY IF EXISTS "Users can insert profiles for their bots" ON bot_profiles;
  DROP POLICY IF EXISTS "Users can update profiles for their bots" ON bot_profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policies with unique names
CREATE POLICY "Users can view profiles for their bots"
  ON bot_profiles
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_profiles.bot_id
    AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert profiles for their bots"
  ON bot_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_profiles.bot_id
    AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can update profiles for their bots"
  ON bot_profiles
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_profiles.bot_id
    AND bots.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_profiles.bot_id
    AND bots.user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS bot_profiles_bot_id_idx ON bot_profiles(bot_id);
CREATE INDEX IF NOT EXISTS bot_profiles_updated_at_idx ON bot_profiles(updated_at DESC);