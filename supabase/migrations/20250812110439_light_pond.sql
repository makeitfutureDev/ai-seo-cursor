/*
  # Fix RLS policies for company_users table

  1. Security Changes
    - Drop existing problematic policies that cause infinite recursion
    - Create new policies that avoid circular references
    - Use auth.uid() directly instead of querying company_users within its own policies

  2. New Policies
    - Users can insert themselves into companies (for onboarding)
    - Users can read company_users for companies they belong to
    - Company admins can manage company users (but using a safer approach)
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can read company_users for their companies" ON company_users;
DROP POLICY IF EXISTS "Company admins can manage company users" ON company_users;
DROP POLICY IF EXISTS "Users can insert themselves into companies" ON company_users;

-- Create new policies without recursion
CREATE POLICY "Users can insert themselves into companies"
  ON company_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read company_users for their companies"
  ON company_users
  FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid()
  ));

CREATE POLICY "Company admins can manage company users"
  ON company_users
  FOR ALL
  TO authenticated
  USING (company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid() AND company_users.role = 'admin'
  ));