/*
  # Create bot messages table

  1. New Tables
    - `bot_messages`
      - `id` (uuid, primary key)
      - `bot_id` (uuid, foreign key)
      - `msg_id` (bigint)
      - `from_user` (text)
      - `to_user` (text) 
      - `msg_type` (integer)
      - `content` (text)
      - `status` (integer)
      - `created_at` (timestamp)
      - `source` (text)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS bot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  msg_id bigint NOT NULL,
  from_user text NOT NULL,
  to_user text NOT NULL,
  msg_type integer NOT NULL,
  content text NOT NULL,
  status integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  source text,
  CONSTRAINT msg_id_bot_id_key UNIQUE (msg_id, bot_id)
);

-- Enable RLS
ALTER TABLE bot_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view messages for their bots"
  ON bot_messages
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_messages.bot_id
    AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages for their bots"
  ON bot_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_messages.bot_id
    AND bots.user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS bot_messages_bot_id_idx ON bot_messages(bot_id);
CREATE INDEX IF NOT EXISTS bot_messages_created_at_idx ON bot_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS bot_messages_msg_id_idx ON bot_messages(msg_id);
CREATE INDEX IF NOT EXISTS bot_messages_from_user_idx ON bot_messages(from_user);
CREATE INDEX IF NOT EXISTS bot_messages_to_user_idx ON bot_messages(to_user);