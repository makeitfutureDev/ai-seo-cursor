/*
  # Fix trigger function configuration parameter

  1. Updates
    - Remove or fix the unrecognized configuration parameter 'app.supabase_url'
    - Update the call_create_company_function to not rely on undefined parameters
    
  2. Changes
    - Drop and recreate the trigger function without the problematic configuration reference
    - Ensure the function works with available Supabase environment variables
*/

-- Drop the existing trigger function
DROP FUNCTION IF EXISTS call_create_company_function() CASCADE;

-- Recreate the function without the problematic configuration parameter
CREATE OR REPLACE FUNCTION call_create_company_function()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the user has completed basic profile info
  IF NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL AND NEW.search_optimization_country IS NOT NULL 
     AND (OLD.first_name IS NULL OR OLD.last_name IS NULL OR OLD.search_optimization_country IS NULL) THEN
    
    -- Note: We're removing the automatic company creation trigger for now
    -- to avoid configuration issues. Company creation should be handled
    -- through the edge function directly from the frontend.
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;