/*
  # Create plugins table

  1. New Tables
    - `plugins`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `trigger` (text)
      - `code` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `user_id` (uuid, foreign key)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create table if not exists
CREATE TABLE IF NOT EXISTS plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger text NOT NULL,
  code text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own plugins" ON plugins;
  DROP POLICY IF EXISTS "Users can create their own plugins" ON plugins;
  DROP POLICY IF EXISTS "Users can update their own plugins" ON plugins;
  DROP POLICY IF EXISTS "Users can delete their own plugins" ON plugins;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policies
CREATE POLICY "Users can view their own plugins"
  ON plugins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plugins"
  ON plugins
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

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

-- Create indexes
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS plugins_user_id_idx ON plugins(user_id);
  CREATE INDEX IF NOT EXISTS plugins_trigger_idx ON plugins(trigger);
  CREATE INDEX IF NOT EXISTS plugins_created_at_idx ON plugins(created_at DESC);
  CREATE INDEX IF NOT EXISTS plugins_updated_at_idx ON plugins(updated_at DESC);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_plugins_updated_at ON plugins;

-- Create trigger
CREATE TRIGGER update_plugins_updated_at
  BEFORE UPDATE ON plugins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();