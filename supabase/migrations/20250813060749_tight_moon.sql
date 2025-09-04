/*
  # Fix prompts RLS policies and ensure countries are accessible

  1. RLS Policies
    - Allow company admins to delete prompts for their companies
    - Simplify policies to avoid recursion
    - Ensure countries table is accessible to authenticated users

  2. Security
    - Company admins can manage all prompts for their companies
    - Users can only access prompts from companies they belong to
    - All authenticated users can read countries
*/

-- Drop existing problematic policies for prompts
DROP POLICY IF EXISTS "Allow Authenticated to update" ON prompts;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON prompts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON prompts;
DROP POLICY IF EXISTS "Enable read access for all users" ON prompts;

-- Create new simplified policies for prompts
CREATE POLICY "Company admins can manage prompts"
  ON prompts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users 
      WHERE company_users.company_id = prompts.company_id 
      AND company_users.user_id = auth.uid() 
      AND company_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users 
      WHERE company_users.company_id = prompts.company_id 
      AND company_users.user_id = auth.uid() 
      AND company_users.role = 'admin'
    )
  );

-- Ensure countries table has proper access
DROP POLICY IF EXISTS "Anyone can read countries" ON countries;

CREATE POLICY "Authenticated users can read countries"
  ON countries
  FOR SELECT
  TO authenticated
  USING (true);

-- Also allow public access to countries for better compatibility
CREATE POLICY "Public can read countries"
  ON countries
  FOR SELECT
  TO public
  USING (true);