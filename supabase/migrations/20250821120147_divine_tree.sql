/*
  # Add sources array column to responses table

  1. Changes
    - Add `sources` column to `responses` table as text array
    - This will allow storing multiple source links for each response
    - The existing `source` column (bigint foreign key) will remain for backward compatibility

  2. New Column
    - `sources` (text array, nullable) - stores multiple source URLs/links as an array
*/

-- Add sources array column to responses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'responses' AND column_name = 'sources'
  ) THEN
    ALTER TABLE responses ADD COLUMN sources text[];
  END IF;
END $$;