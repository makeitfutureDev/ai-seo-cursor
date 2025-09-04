const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface GeneratePromptsRequest {
  companyId: string;
  companyGoal: string;
}

interface WebhookResponse {
  prompts: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { companyId, companyGoal }: GeneratePromptsRequest = await req.json();

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user has access to this company
    const { data: companyUser, error: companyUserError } = await supabase
      .from('company_users')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single();

    if (companyUserError || !companyUser) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this company' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, domain, country')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update company with goal
    const { error: updateError } = await supabase
      .from('companies')
      .update({ goal: companyGoal })
      .eq('id', companyId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update company goal' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Call the webhook
    const webhookUrl = 'https://makeitfutureeu.app.n8n.cloud/webhook/f1066e25-51b2-45d7-a687-077c3e716173';
    
    // Get user profile for search optimization country
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('search_optimization_country')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const webhookPayload = {
      company_name: company.name,
      company_domain: company.domain,
      company_goal: companyGoal,
      location: userProfile.search_optimization_country
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!webhookResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to generate prompts from webhook',
          status: webhookResponse.status,
          statusText: webhookResponse.statusText,
          details: `Webhook returned ${webhookResponse.status}: ${webhookResponse.statusText}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const webhookData: WebhookResponse = await webhookResponse.json();
    
    if (!webhookData || !webhookData.prompts) {
      return new Response(
        JSON.stringify({ error: 'Invalid response format from webhook' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const prompts = webhookData.prompts;

    // Save prompts to database
    const promptsToInsert = prompts.map(prompt => ({
      prompt: prompt,
      description: `Generated prompt for ${company.name}`,
      country: userProfile.search_optimization_country,
      company_id: companyId
    }));

    const { data: savedPrompts, error: promptsError } = await supabase
      .from('prompts')
      .insert(promptsToInsert)
      .select();

    if (promptsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to save prompts to database' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        prompts: savedPrompts,
        message: `Generated and saved ${prompts.length} prompts successfully`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});