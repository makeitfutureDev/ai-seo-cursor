/*
  # Fix prompt deletion permissions

  1. Security Updates
    - Add proper DELETE policy for prompts table
    - Ensure company admins can delete prompts from their companies
    - Fix any missing RLS policies

  2. Policy Details
    - Company admins can delete prompts from companies they admin
    - Uses company_users table to verify admin role
    - Matches existing pattern from other CRUD policies
*/

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Company admins can delete prompts" ON prompts;

-- Create proper delete policy for company admins
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

-- Ensure RLS is enabled
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Verify all policies exist (this will show in logs)
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'prompts'
ORDER BY cmd, policyname;