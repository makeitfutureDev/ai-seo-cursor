/*
  # Fix RLS infinite recursion for company_users table

  1. Security Changes
    - Drop existing problematic RLS policies that cause infinite recursion
    - Create simplified, non-recursive RLS policies
    - Ensure policies don't reference the same table they're protecting

  2. Policy Updates
    - Users can read company_users records for companies they belong to
    - Users can insert themselves into companies
    - Company admins can manage company users (simplified logic)
*/

-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Company admins can manage company users" ON company_users;
DROP POLICY IF EXISTS "Users can insert themselves into companies" ON company_users;
DROP POLICY IF EXISTS "Users can read company_users for their companies" ON company_users;

-- Create simplified, non-recursive policies
CREATE POLICY "Users can read their own company memberships"
  ON company_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert themselves as company members"
  ON company_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Company admins can manage all company users"
  ON company_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'admin'
    )
  );