/*
  # Fix plugins table RLS policies

  1. Changes
    - Add user_id column to plugins table
    - Update RLS policies to properly handle user ownership
    - Add appropriate indexes for performance

  2. Security
    - Enable RLS
    - Add policies for authenticated users to manage their own plugins
*/

-- Add user_id column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE plugins 
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can create their own plugins" ON plugins;
  DROP POLICY IF EXISTS "Users can view their own plugins" ON plugins;
  DROP POLICY IF EXISTS "Users can update their own plugins" ON plugins;
  DROP POLICY IF EXISTS "Users can delete their own plugins" ON plugins;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies
CREATE POLICY "Users can create their own plugins"
  ON plugins
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own plugins"
  ON plugins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own plugins"
  ON plugins
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plugins"
  ON plugins
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS plugins_user_id_idx ON plugins(user_id);
CREATE INDEX IF NOT EXISTS plugins_trigger_idx ON plugins(trigger);
CREATE INDEX IF NOT EXISTS plugins_created_at_idx ON plugins(created_at DESC);
CREATE INDEX IF NOT EXISTS plugins_updated_at_idx ON plugins(updated_at DESC);