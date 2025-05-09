/*
  # Fix database schema issues

  1. Changes
    - Drop duplicate tables if they exist
    - Recreate tables with proper types and constraints
    - Add missing indexes
    - Fix foreign key reference type for user_id

  2. Security
    - Maintain existing RLS policies
    - Ensure proper cascade behavior
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS bot_events;
DROP TABLE IF EXISTS bots;

-- Create bots table with proper types
CREATE TABLE bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  wxid text,
  nickname text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz,
  user_id uuid NOT NULL,
  CONSTRAINT status_check CHECK (status IN ('offline', 'online', 'authenticating')),
  CONSTRAINT bots_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE
);

-- Create bot_events table
CREATE TABLE bot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT event_type_check CHECK (event_type IN ('info', 'success', 'warning', 'error')),
  CONSTRAINT bot_events_bot_id_fkey FOREIGN KEY (bot_id) 
    REFERENCES bots(id) 
    ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_events ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS bots_user_id_idx ON bots(user_id);
CREATE INDEX IF NOT EXISTS bots_status_idx ON bots(status);
CREATE INDEX IF NOT EXISTS bots_created_at_idx ON bots(created_at DESC);
CREATE INDEX IF NOT EXISTS bots_last_active_at_idx ON bots(last_active_at DESC);

CREATE INDEX IF NOT EXISTS bot_events_bot_id_idx ON bot_events(bot_id);
CREATE INDEX IF NOT EXISTS bot_events_event_type_idx ON bot_events(event_type);
CREATE INDEX IF NOT EXISTS bot_events_created_at_idx ON bot_events(created_at DESC);

-- Create policies for bots table
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

CREATE POLICY "Users can delete their own bots"
  ON bots
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for bot_events table
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