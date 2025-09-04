const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface AnalyzePromptsRequest {
  companyId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { companyId }: AnalyzePromptsRequest = await req.json();

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

    // Call the webhook for competitor analysis
    const webhookUrl = 'https://makeitfutureeu.app.n8n.cloud/webhook/43faa5bc-a0dc-44e5-bdc7-879daeb8c456';
    
    const webhookPayload = {
      company: companyId
    };

    console.log('Calling webhook with payload:', webhookPayload);

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!webhookResponse.ok) {
      console.error('Webhook failed:', webhookResponse.status, webhookResponse.statusText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to analyze prompts via webhook',
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

    // Check if response has content and is JSON
    const contentType = webhookResponse.headers.get('Content-Type') || '';
    const contentLength = webhookResponse.headers.get('Content-Length');
    
    let webhookData;
    
    if (contentLength === '0' || contentLength === null) {
      console.log('Webhook returned empty response');
      webhookData = { message: 'Analysis completed successfully (empty response)' };
    } else if (!contentType.includes('application/json')) {
      console.log('Webhook returned non-JSON response, content-type:', contentType);
      const textResponse = await webhookResponse.text();
      webhookData = { message: 'Analysis completed successfully', response: textResponse };
    } else {
      try {
        webhookData = await webhookResponse.json();
      } catch (jsonError) {
        console.error('Failed to parse webhook JSON response:', jsonError);
        const textResponse = await webhookResponse.text();
        return new Response(
          JSON.stringify({ 
            error: 'Webhook returned malformed JSON response',
            details: `JSON parse error: ${jsonError.message}`,
            rawResponse: textResponse
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }
    
    console.log('Webhook response:', webhookData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Prompt analysis completed successfully',
        data: webhookData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in analyze-prompts function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});