/*
  # Create companies table and user roles system

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `name` (text, company name)
      - `domain` (text, company domain)
      - `country` (text, company country)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `company_users`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `user_id` (uuid, foreign key to user_profiles)
      - `role` (text, 'admin' or 'read_only')
      - `created_at` (timestamp)

  2. Changes to user_profiles
    - Remove company-related fields (moved to companies table)
    - Keep search_optimization_country for user preferences

  3. Security
    - Enable RLS on all tables
    - Add policies for company access based on user roles
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text,
  country text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create company_users junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'read_only')) DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Remove company fields from user_profiles (keep search_optimization_country for user preference)
DO $$
BEGIN
  -- Remove company_name column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN company_name;
  END IF;

  -- Remove company_domain column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'company_domain'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN company_domain;
  END IF;

  -- Remove company_country column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'company_country'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN company_country;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Users can read companies they belong to"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can update their companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can create companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Company users policies
CREATE POLICY "Users can read company_users for their companies"
  ON company_users
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can manage company users"
  ON company_users
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert themselves into companies"
  ON company_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());