/*
  # Update keyword replies table

  1. Changes
    - Remove bot_id column and its foreign key constraint
    - Update RLS policies to be user-based instead of bot-based
    - Add user_id column to track ownership
    - Add description column for better organization

  2. Security
    - Enable RLS
    - Add policies for authenticated users to manage their own replies
*/

-- Drop existing table and recreate with new structure
DROP TABLE IF EXISTS keyword_replies;

CREATE TABLE keyword_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  reply text NOT NULL,
  reply_type text NOT NULL,
  match_type text NOT NULL,
  scope text NOT NULL DEFAULT 'all',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT reply_type_check CHECK (reply_type IN ('text', 'image', 'voice')),
  CONSTRAINT match_type_check CHECK (match_type IN ('exact', 'fuzzy', 'regex')),
  CONSTRAINT scope_check CHECK (scope IN ('all', 'private', 'group'))
);

-- Enable RLS
ALTER TABLE keyword_replies ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own keyword replies"
  ON keyword_replies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own keyword replies"
  ON keyword_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own keyword replies"
  ON keyword_replies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own keyword replies"
  ON keyword_replies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX keyword_replies_user_id_idx ON keyword_replies(user_id);
CREATE INDEX keyword_replies_created_at_idx ON keyword_replies(created_at DESC);
CREATE INDEX keyword_replies_keyword_idx ON keyword_replies(keyword);
CREATE INDEX keyword_replies_scope_idx ON keyword_replies(scope);
CREATE INDEX keyword_replies_is_active_idx ON keyword_replies(is_active);