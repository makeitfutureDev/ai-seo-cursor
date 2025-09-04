/*
  # Fix prompts table RLS policies for deletion

  1. Security Updates
    - Ensure company admins can delete prompts from their companies
    - Add proper delete policy for prompts table
    - Verify existing policies are working correctly

  2. Changes
    - Add delete policy for company admins
    - Ensure proper foreign key relationships
*/

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Company admins can delete prompts" ON prompts;

-- Create comprehensive delete policy for prompts
CREATE POLICY "Company admins can delete prompts"
  ON prompts
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_users.company_id
      FROM company_users
      WHERE company_users.user_id = auth.uid()
      AND company_users.role = 'admin'
    )
  );

-- Ensure RLS is enabled on prompts table
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Verify all existing policies on prompts table
-- (This is just for reference, the policies should already exist)
DO $$
BEGIN
  -- Check if select policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'prompts' 
    AND policyname = 'Company members can read prompts'
  ) THEN
    CREATE POLICY "Company members can read prompts"
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
  END IF;

  -- Check if insert policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'prompts' 
    AND policyname = 'Company admins can insert prompts'
  ) THEN
    CREATE POLICY "Company admins can insert prompts"
      ON prompts
      FOR INSERT
      TO authenticated
      WITH CHECK (
        company_id IN (
          SELECT company_users.company_id
          FROM company_users
          WHERE company_users.user_id = auth.uid()
          AND company_users.role = 'admin'
        )
      );
  END IF;

  -- Check if update policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'prompts' 
    AND policyname = 'Company admins can update prompts'
  ) THEN
    CREATE POLICY "Company admins can update prompts"
      ON prompts
      FOR UPDATE
      TO authenticated
      USING (
        company_id IN (
          SELECT company_users.company_id
          FROM company_users
          WHERE company_users.user_id = auth.uid()
          AND company_users.role = 'admin'
        )
      )
      WITH CHECK (
        company_id IN (
          SELECT company_users.company_id
          FROM company_users
          WHERE company_users.user_id = auth.uid()
          AND company_users.role = 'admin'
        )
      );
  END IF;
END $$;