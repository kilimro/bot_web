/*
  # Create bot management tables

  1. New Tables
    - `bots`
      - `id` (uuid, primary key)
      - `auth_key` (text, unique)
      - `status` (text)
      - `wxid` (text)
      - `nickname` (text)
      - `avatar_url` (text)
      - `created_at` (timestamp)
      - `last_active_at` (timestamp)
      - `user_id` (uuid, foreign key)
    
    - `bot_events`
      - `id` (uuid, primary key)
      - `bot_id` (uuid, foreign key)
      - `event_type` (text)
      - `message` (text)
      - `details` (jsonb)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to:
      - Read their own bots and events
      - Create/update their own bots and events
*/

-- Create bots table
CREATE TABLE IF NOT EXISTS bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  wxid text,
  nickname text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  CONSTRAINT status_check CHECK (status IN ('offline', 'online', 'authenticating'))
);

-- Create bot_events table
CREATE TABLE IF NOT EXISTS bot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid REFERENCES bots(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT event_type_check CHECK (event_type IN ('info', 'success', 'warning', 'error'))
);

-- Enable RLS
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_events ENABLE ROW LEVEL SECURITY;

-- Policies for bots table
CREATE POLICY "Users can view their own bots"
  ON bots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bots"
  ON bots
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots"
  ON bots
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for bot_events table
CREATE POLICY "Users can view events for their bots"
  ON bot_events
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_events.bot_id
    AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can create events for their bots"
  ON bot_events
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_events.bot_id
    AND bots.user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS bots_user_id_idx ON bots(user_id);
CREATE INDEX IF NOT EXISTS bot_events_bot_id_idx ON bot_events(bot_id);
CREATE INDEX IF NOT EXISTS bot_events_created_at_idx ON bot_events(created_at DESC);