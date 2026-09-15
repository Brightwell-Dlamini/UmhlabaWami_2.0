import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-authorization, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface Body {
  organizationId: string;
  approverName: string;
  customCode?: string;
}

Deno.serve(async (req) => {
  // Preflight must always succeed with 2xx + CORS headers (no auth)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

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
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
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

    // Approve org via RPC (preferred) or direct update
    let updatedOrg = org;
    const { data: rpcOrg, error: approveErr } = await admin.rpc('approve_organization', {
      p_org_id: body.organizationId,
      p_approver_name: body.approverName || 'Super Admin',
      p_custom_code: body.customCode ?? null,
    });

    if (approveErr) {
      // Fallback if RPC missing / return type mismatch
      let code =
        (body.customCode || '').trim().toUpperCase() ||
        (org.organization_code && !String(org.organization_code).startsWith('PENDING')
          ? org.organization_code
          : generateOrgCode(org.company_name));

      const { data: patched, error: patchErr } = await admin
        .from('organizations')
        .update({
          status: 'Active',
          organization_code: code,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', body.organizationId)
        .select('*')
        .single();

      if (patchErr || !patched) {
        return json({ error: approveErr.message || patchErr?.message || 'Approve failed' }, 500);
      }
      updatedOrg = patched;
    } else {
      updatedOrg = Array.isArray(rpcOrg) ? rpcOrg[0] : rpcOrg;
      await admin.from('organizations').update({ approved_by: user.id }).eq('id', updatedOrg.id);
    }

    // Resolve owner auth user id
    let ownerId: string | null = org.owner_auth_user_id || null;
    if (!ownerId && org.email) {
      const { data: byEmail } = await admin
        .from('profiles')
        .select('id')
        .eq('email', String(org.email).toLowerCase())
        .maybeSingle();
      ownerId = byEmail?.id ?? null;
    }

    if (ownerId) {
      const { error: profileErr } = await admin
        .from('profiles')
        .update({
          organization_id: updatedOrg.id,
          role: 'admin',
          status: 'Active',
        })
        .eq('id', ownerId);
      if (profileErr) {
        console.error('profile update warning', profileErr.message);
      }

      try {
        await admin.from('notifications').insert({
          user_id: ownerId,
          role: 'admin',
          organization_id: updatedOrg.id,
          type: 'approval',
          title: 'Your organisation is approved',
          message: `Welcome to Umhlaba Wami. Your org code is ${updatedOrg.organization_code}. Sign in with the password you set during registration.`,
          read: false,
        });
      } catch {
        // ignore
      }
    }

    return json({
      success: true,
      organizationId: updatedOrg.id,
      organizationCode: updatedOrg.organization_code,
      adminUserId: ownerId || '',
      inviteSent: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, 500);
  }
});

function generateOrgCode(companyName: string): string {
  const prefix =
    (companyName || 'ORG').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'ORG';
  const d = new Date();
  const date =
    String(d.getDate()).padStart(2, '0') +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getFullYear()).slice(-2);
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${date}-${rand}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
