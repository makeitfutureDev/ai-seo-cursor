/*
  # Fix RLS policies for prompts table

  1. Security Updates
    - Drop existing restrictive policies
    - Add comprehensive policies for all CRUD operations
    - Allow company users to manage prompts for their companies
    - Ensure proper access control based on company membership

  2. Policy Changes
    - SELECT: Company users can read prompts for their companies
    - INSERT: Company users can create prompts for their companies  
    - UPDATE: Company users can update prompts for their companies
    - DELETE: Company users can delete prompts for their companies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Company admins can insert prompts" ON prompts;
DROP POLICY IF EXISTS "Company users can read their company prompts" ON prompts;

-- Create comprehensive policies for all CRUD operations
CREATE POLICY "Company users can read company prompts"
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

CREATE POLICY "Company users can insert company prompts"
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

CREATE POLICY "Company users can update company prompts"
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

CREATE POLICY "Company users can delete company prompts"
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