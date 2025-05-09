/*
  # Create bots and events tables

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
    - Add policies for authenticated users to manage their own bots and events
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
  user_id uuid NOT NULL REFERENCES auth.users(id)
);

-- Create bot_events table
CREATE TABLE IF NOT EXISTS bot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_events ENABLE ROW LEVEL SECURITY;

-- Add status check constraint
DO $$ BEGIN
  ALTER TABLE bots ADD CONSTRAINT status_check 
    CHECK (status IN ('offline', 'online', 'authenticating'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add event_type check constraint
DO $$ BEGIN
  ALTER TABLE bot_events ADD CONSTRAINT event_type_check 
    CHECK (event_type IN ('info', 'success', 'warning', 'error'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create policies for bots table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can create their own bots" ON bots;
  CREATE POLICY "Users can create their own bots"
    ON bots
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own bots" ON bots;
  CREATE POLICY "Users can view their own bots"
    ON bots
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update their own bots" ON bots;
  CREATE POLICY "Users can update their own bots"
    ON bots
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can delete their own bots" ON bots;
  CREATE POLICY "Users can delete their own bots"
    ON bots
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policies for bot_events table
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can create events for their bots" ON bot_events;
  CREATE POLICY "Users can create events for their bots"
    ON bot_events
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM bots 
      WHERE bots.id = bot_events.bot_id 
      AND bots.user_id = auth.uid()
    ));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view events for their bots" ON bot_events;
  CREATE POLICY "Users can view events for their bots"
    ON bot_events
    FOR SELECT
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM bots 
      WHERE bots.id = bot_events.bot_id 
      AND bots.user_id = auth.uid()
    ));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;