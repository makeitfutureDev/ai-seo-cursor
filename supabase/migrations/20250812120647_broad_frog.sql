/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Current prompts policies cause infinite recursion when checking company_users
    - The subquery in the policies creates circular dependencies

  2. Solution
    - Simplify the RLS policies to avoid recursive queries
    - Use direct foreign key relationships instead of complex subqueries
    - Ensure policies don't reference tables that might query back to company_users

  3. Changes
    - Drop existing problematic policies
    - Create new simplified policies that avoid recursion
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Company users can read company prompts" ON prompts;
DROP POLICY IF EXISTS "Company users can insert company prompts" ON prompts;
DROP POLICY IF EXISTS "Company users can update company prompts" ON prompts;
DROP POLICY IF EXISTS "Company users can delete company prompts" ON prompts;

-- Create new simplified policies that avoid recursion
CREATE POLICY "Users can read prompts for their companies"
  ON prompts
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert prompts for their companies"
  ON prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update prompts for their companies"
  ON prompts
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete prompts for their companies"
  ON prompts
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );