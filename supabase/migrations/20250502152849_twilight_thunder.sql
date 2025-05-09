/*
  # Fix RLS policies for bots table

  1. Changes
    - Drop existing RLS policies for bots table
    - Create new RLS policies with correct conditions:
      - Users can create their own bots
      - Users can view their own bots
      - Users can update their own bots
      - Users can delete their own bots
  
  2. Security
    - Ensures users can only manage their own bots
    - Maintains data isolation between users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own bots" ON bots;
DROP POLICY IF EXISTS "Users can view their own bots" ON bots;
DROP POLICY IF EXISTS "Users can update their own bots" ON bots;
DROP POLICY IF EXISTS "Users can delete their own bots" ON bots;

-- Create new policies
CREATE POLICY "Users can create their own bots"
ON bots
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own bots"
ON bots
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

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