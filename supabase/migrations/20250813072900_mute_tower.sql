/*
  # Create separate RLS policies for prompts

  1. Security Changes
    - Drop the existing broad policy that might be causing issues
    - Create specific policies for each action (SELECT, INSERT, UPDATE, DELETE)
    - Ensure company admins can manage prompts for their companies
    - Allow all company members to read prompts

  2. New Policies
    - SELECT: All company members can read prompts
    - INSERT: Company admins can create prompts
    - UPDATE: Company admins can update prompts  
    - DELETE: Company admins can delete prompts
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Company admins can manage prompts" ON prompts;
DROP POLICY IF EXISTS "Users can read prompts from their companies" ON prompts;

-- Create specific policy for reading prompts (all company members)
CREATE POLICY "Company members can read prompts"
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

-- Create specific policy for inserting prompts (company admins only)
CREATE POLICY "Company admins can insert prompts"
  ON prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create specific policy for updating prompts (company admins only)
CREATE POLICY "Company admins can update prompts"
  ON prompts
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create specific policy for deleting prompts (company admins only)
CREATE POLICY "Company admins can delete prompts"
  ON prompts
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );