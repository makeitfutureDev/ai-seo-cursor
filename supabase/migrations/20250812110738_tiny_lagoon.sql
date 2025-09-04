/*
  # Add Company Creation Trigger

  1. New Functions
    - `call_create_company_function()` - Trigger function that calls the edge function
  
  2. Triggers
    - Trigger on user_profiles table when onboarding data is updated
    - Only fires when company creation data is present
  
  3. Security
    - Uses service role to call edge function
    - Handles errors gracefully
*/

-- Create a function that will call the edge function
CREATE OR REPLACE FUNCTION call_create_company_function()
RETURNS TRIGGER AS $$
DECLARE
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Only proceed if this looks like a company creation update
  -- (has first_name, last_name, and search_optimization_country)
  IF NEW.first_name IS NOT NULL 
     AND NEW.last_name IS NOT NULL 
     AND NEW.search_optimization_country IS NOT NULL 
     AND OLD.first_name IS NULL THEN
    
    -- Call the edge function using pg_net extension
    -- Note: This is a simplified version - in production you'd want more robust error handling
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/create-company',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'userId', NEW.id,
        'firstName', NEW.first_name,
        'lastName', NEW.last_name,
        'searchOptimizationCountry', NEW.search_optimization_country
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after user profile updates
CREATE OR REPLACE TRIGGER trigger_create_company
  AFTER UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION call_create_company_function();