/*
  # Create countries table and populate with data

  1. New Tables
    - `countries`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `code` (text, unique, ISO country code)
      - `created_at` (timestamp)

  2. Data
    - Populate with common countries

  3. Security
    - Enable RLS on `countries` table
    - Add policy for public read access
*/

CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read countries"
  ON countries
  FOR SELECT
  TO public
  USING (true);

-- Insert common countries
INSERT INTO countries (name, code) VALUES
  ('United States', 'US'),
  ('Canada', 'CA'),
  ('United Kingdom', 'GB'),
  ('Germany', 'DE'),
  ('France', 'FR'),
  ('Italy', 'IT'),
  ('Spain', 'ES'),
  ('Netherlands', 'NL'),
  ('Belgium', 'BE'),
  ('Switzerland', 'CH'),
  ('Austria', 'AT'),
  ('Sweden', 'SE'),
  ('Norway', 'NO'),
  ('Denmark', 'DK'),
  ('Finland', 'FI'),
  ('Poland', 'PL'),
  ('Czech Republic', 'CZ'),
  ('Hungary', 'HU'),
  ('Romania', 'RO'),
  ('Bulgaria', 'BG'),
  ('Greece', 'GR'),
  ('Portugal', 'PT'),
  ('Ireland', 'IE'),
  ('Australia', 'AU'),
  ('New Zealand', 'NZ'),
  ('Japan', 'JP'),
  ('South Korea', 'KR'),
  ('Singapore', 'SG'),
  ('Hong Kong', 'HK'),
  ('India', 'IN'),
  ('Brazil', 'BR'),
  ('Mexico', 'MX'),
  ('Argentina', 'AR'),
  ('Chile', 'CL'),
  ('Colombia', 'CO'),
  ('Peru', 'PE'),
  ('South Africa', 'ZA'),
  ('Israel', 'IL'),
  ('United Arab Emirates', 'AE'),
  ('Saudi Arabia', 'SA'),
  ('Turkey', 'TR'),
  ('Russia', 'RU'),
  ('Ukraine', 'UA'),
  ('Other', 'XX')
ON CONFLICT (name) DO NOTHING;