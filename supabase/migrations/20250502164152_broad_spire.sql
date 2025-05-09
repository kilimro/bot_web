/*
  # Add updated_at column to keyword_replies table

  1. Changes
    - Add `updated_at` column to `keyword_replies` table
    - Add trigger to automatically update `updated_at` on record changes
  
  2. Security
    - No changes to existing RLS policies
*/

-- Add updated_at column
ALTER TABLE keyword_replies 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger to update updated_at column
CREATE OR REPLACE TRIGGER update_keyword_replies_updated_at
    BEFORE UPDATE ON keyword_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();