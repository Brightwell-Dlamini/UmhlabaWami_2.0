import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  organizationId: string;
  approverName: string;
  customCode?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is super admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'super_admin') {
      return json({ error: 'Super admin role required' }, 403);
    }

    const body = (await req.json()) as Body;
    if (!body.organizationId) return json({ error: 'organizationId required' }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch org
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('*')
      .eq('id', body.organizationId)
      .single();
    if (orgErr || !org) return json({ error: 'Organization not found' }, 404);
    if (org.status === 'Active') return json({ error: 'Organization already active' }, 400);
    if (!org.owner_auth_user_id) {
      return json({ error: 'Organization has no registered owner auth user' }, 400);
    }

    // Approve org
    const { data: updatedOrg, error: approveErr } = await admin.rpc('approve_organization', {
      p_org_id: body.organizationId,
      p_approver_name: body.approverName || 'Super Admin',
      p_custom_code: body.customCode ?? null,
    });
    if (approveErr) return json({ error: approveErr.message }, 500);

    // Attach the owner to the org with admin role
    const { error: profileErr } = await admin
      .from('profiles')
      .update({
        organization_id: updatedOrg.id,
        role: 'admin',
        status: 'Active',
      })
      .eq('id', org.owner_auth_user_id);
    if (profileErr) return json({ error: profileErr.message }, 500);

    // Record approver
    await admin.from('organizations').update({ approved_by: user.id }).eq('id', updatedOrg.id);

    // Welcome notification
    await admin.from('notifications').insert({
      user_id: org.owner_auth_user_id,
      role: 'admin',
      organization_id: updatedOrg.id,
      type: 'approval',
      title: 'Your organisation is approved',
      message: `Welcome to Umhlaba Wami. Your org code is ${updatedOrg.organization_code}. Sign in with the password you set during registration.`,
    });

    return json({
      success: true,
      organizationId: updatedOrg.id,
      organizationCode: updatedOrg.organization_code,
      adminUserId: org.owner_auth_user_id,
      inviteSent: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
