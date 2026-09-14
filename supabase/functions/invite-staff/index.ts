import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  organizationId: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ---- Check caller ----
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: caller } = await userClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();
    if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
      return json({ error: 'Admin role required' }, 403);
    }

    const body = (await req.json()) as Body;
    if (!body.email || !body.name || !body.role || !body.organizationId) {
      return json({ error: 'Missing required fields' }, 400);
    }

    // ---- Service-role client ----
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- Check if auth user already exists ----
    let authUserId: string | null = null;
    let inviteSent = false;

    const { data: list } = await admin.auth.admin.listUsers();
    const match = list?.users.find((u) => u.email?.toLowerCase() === body.email.toLowerCase());

    if (match) {
      authUserId = match.id;
    } else {
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
        body.email.toLowerCase(),
        {
          data: {
            name: body.name,
            username: body.email.split('@')[0],
            role: body.role,
          },
          redirectTo: `${new URL(req.url).origin}/auth/callback`,
        }
      );
      if (inviteErr) return json({ error: inviteErr.message }, 500);
      authUserId = invited.user?.id ?? null;
      inviteSent = true;
    }

    if (!authUserId) return json({ error: 'Could not create user' }, 500);

    // ---- Upsert profile row ----
    const { error: profileErr } = await admin
      .from('profiles')
      .upsert({
        id: authUserId,
        organization_id: body.organizationId,
        email: body.email.toLowerCase(),
        name: body.name,
        username: body.email.split('@')[0],
        phone: body.phone ?? null,
        role: body.role,
        status: 'Active',
      });
    if (profileErr) return json({ error: profileErr.message }, 500);

    return json({ success: true, userId: authUserId, inviteSent });
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
