/*
  # Create prompts table and update companies table

  1. New Tables
    - `prompts`
      - `id` (uuid, primary key)
      - `prompt` (text, the generated prompt)
      - `description` (text, description of the prompt)
      - `country` (text, target country)
      - `company_id` (uuid, foreign key to companies)
      - `created_at` (timestamp)

  2. Table Updates
    - Add `goal` column to `companies` table

  3. Security
    - Enable RLS on `prompts` table
    - Add policies for company users to read their prompts
*/

-- Add goal column to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'goal'
  ) THEN
    ALTER TABLE companies ADD COLUMN goal text;
  END IF;
END $$;

-- Create prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  description text,
  country text,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Allow company users to read prompts for their companies
CREATE POLICY "Company users can read their company prompts"
  ON prompts
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_users.company_id
      FROM company_users
      WHERE company_users.user_id = auth.uid()
    )
  );

-- Allow company admins to insert prompts
CREATE POLICY "Company admins can insert prompts"
  ON prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_users.company_id
      FROM company_users
      WHERE company_users.user_id = auth.uid() AND company_users.role = 'admin'
    )
  );