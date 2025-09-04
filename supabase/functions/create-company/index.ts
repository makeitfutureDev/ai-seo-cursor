const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CreateCompanyRequest {
  companyName: string;
  companyDomain: string;
  companyCountry: string;
  firstName?: string;
  lastName?: string;
  searchOptimizationCountry?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  console.log('=== CREATE COMPANY FUNCTION START ===');
  
  try {
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const { 
      companyName, 
      companyDomain, 
      companyCountry,
      firstName,
      lastName,
      searchOptimizationCountry
    }: CreateCompanyRequest = await req.json();

    console.log('Request payload:', {
      companyName,
      companyDomain,
      companyCountry,
      firstName,
      lastName,
      searchOptimizationCountry
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.log('❌ Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    console.log('Supabase URL present:', !!supabaseUrl);
    console.log('Service key present:', !!supabaseServiceKey);
    
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase client created');

    // Get user from JWT token
    const jwt = authHeader.replace('Bearer ', '');
    console.log('JWT token length:', jwt.length);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    console.log('User auth result:', { user: !!user, error: userError });
    
    if (userError || !user) {
      console.log('❌ Invalid or expired token:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Create the company
    console.log('🏢 Creating company...');
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        domain: companyDomain,
        country: companyCountry
      })
      .select()
      .single();

    console.log('Company creation result:', { company: !!company, error: companyError });
    
    if (companyError) {
      console.log('❌ Failed to create company:', companyError);
      return new Response(
        JSON.stringify({ error: 'Failed to create company', details: companyError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Company created:', company.id);

    // Add user as admin to the company
    console.log('👤 Adding user to company...');
    const { error: companyUserError } = await supabase
      .from('company_users')
      .insert({
        company_id: company.id,
        user_id: user.id,
        role: 'admin'
      });

    console.log('Company user creation result:', { error: companyUserError });
    
    if (companyUserError) {
      console.log('❌ Failed to add user to company:', companyUserError);
      // Rollback: delete the company if adding user fails
      console.log('🔄 Rolling back company creation...');
      await supabase.from('companies').delete().eq('id', company.id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to add user to company', details: companyUserError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ User added to company');

    // Update user profile if profile data is provided
    if (firstName || lastName || searchOptimizationCountry) {
      console.log('📝 Updating user profile...');
      const profileUpdate: any = {};
      if (firstName) profileUpdate.first_name = firstName;
      if (lastName) profileUpdate.last_name = lastName;
      if (searchOptimizationCountry) profileUpdate.search_optimization_country = searchOptimizationCountry;
      profileUpdate.updated_at = new Date().toISOString();

      console.log('Profile update data:', profileUpdate);
      
      const { error: profileUpdateError } = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      console.log('Profile update result:', { error: profileUpdateError });
      
      if (profileUpdateError) {
        console.log('⚠️ Profile update failed:', profileUpdateError);
        // Don't fail the entire operation for profile update issues
      } else {
        console.log('✅ Profile updated');
      }
    }
    
    console.log('✅ Company creation completed successfully');
    return new Response(
      JSON.stringify({ 
        success: true, 
        company: company,
        message: 'Company created and user added successfully' 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.log('❌ Unexpected error in create-company function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } finally {
    console.log('=== CREATE COMPANY FUNCTION END ===');
  }
});