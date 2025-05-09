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

CREATE TABLE plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger text NOT NULL,
  code text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Enable RLS
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;

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
CREATE INDEX plugins_user_id_idx ON plugins(user_id);
CREATE INDEX plugins_trigger_idx ON plugins(trigger);
CREATE INDEX plugins_created_at_idx ON plugins(created_at DESC);
CREATE INDEX plugins_updated_at_idx ON plugins(updated_at DESC);

-- Create trigger for updating updated_at
CREATE TRIGGER update_plugins_updated_at
  BEFORE UPDATE ON plugins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();