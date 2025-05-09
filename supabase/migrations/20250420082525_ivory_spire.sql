/*
  # Create keyword replies table

  1. New Tables
    - `keyword_replies`
      - `id` (uuid, primary key)
      - `bot_id` (uuid, foreign key)
      - `keyword` (text)
      - `reply` (text)
      - `reply_type` (text) - text/image/voice
      - `match_type` (text) - exact/fuzzy/regex
      - `scope` (text) - all/private/group
      - `is_active` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for authenticated users to manage their own keyword replies
*/

CREATE TABLE IF NOT EXISTS keyword_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  reply text NOT NULL,
  reply_type text NOT NULL,
  match_type text NOT NULL,
  scope text NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT reply_type_check CHECK (reply_type IN ('text', 'image', 'voice')),
  CONSTRAINT match_type_check CHECK (match_type IN ('exact', 'fuzzy', 'regex')),
  CONSTRAINT scope_check CHECK (scope IN ('all', 'private', 'group'))
);

-- Enable RLS
ALTER TABLE keyword_replies ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view keyword replies for their bots"
  ON keyword_replies
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = keyword_replies.bot_id
    AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can create keyword replies for their bots"
  ON keyword_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = keyword_replies.bot_id
    AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can update keyword replies for their bots"
  ON keyword_replies
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = keyword_replies.bot_id
    AND bots.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = keyword_replies.bot_id
    AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete keyword replies for their bots"
  ON keyword_replies
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = keyword_replies.bot_id
    AND bots.user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS keyword_replies_bot_id_idx ON keyword_replies(bot_id);
CREATE INDEX IF NOT EXISTS keyword_replies_created_at_idx ON keyword_replies(created_at DESC);
CREATE INDEX IF NOT EXISTS keyword_replies_keyword_idx ON keyword_replies(keyword);