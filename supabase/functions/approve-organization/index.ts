// Supabase Edge Function — service role required.
// Approves a pending organisation and provisions the first admin user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  organizationId: string;
  approverName: string;
  customCode?: string;
  adminEmail?: string;   // defaults to org.email
  adminName?: string;    // defaults to org.owner_name
  temporaryPassword?: string; // if absent, invite email is sent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ---- Verify caller is a super admin ----
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

    // ---- Parse body ----
    const body = (await req.json()) as Body;
    if (!body.organizationId) {
      return json({ error: 'organizationId required' }, 400);
    }

    // ---- Service-role client ----
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- Fetch org ----
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('*')
      .eq('id', body.organizationId)
      .single();
    if (orgErr || !org) return json({ error: 'Organization not found' }, 404);
    if (org.status === 'Active') {
      return json({ error: 'Organization already active' }, 400);
    }

    // ---- Approve org (SQL function) ----
    const { data: updatedOrg, error: approveErr } = await admin.rpc(
      'approve_organization',
      {
        p_org_id: body.organizationId,
        p_approver_name: body.approverName || 'Super Admin',
        p_custom_code: body.customCode ?? null,
      }
    );
    if (approveErr) return json({ error: approveErr.message }, 500);

    // ---- Provision admin auth user ----
    const adminEmail = (body.adminEmail || org.email).toLowerCase();
    const adminName = body.adminName || org.owner_name;

    let authUserId: string | null = null;
    let inviteSent = false;

    // Check if a user with this email already exists
    const { data: existing } = await admin.auth.admin.listUsers();
    const match = existing?.users.find(
      (u) => u.email?.toLowerCase() === adminEmail
    );

    if (match) {
      authUserId = match.id;
    } else if (body.temporaryPassword) {
      // Direct creation with a password
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: adminEmail,
        password: body.temporaryPassword,
        email_confirm: true,
        user_metadata: {
          name: adminName,
          username: adminEmail.split('@')[0],
          role: 'admin',
        },
      });
      if (createErr) return json({ error: createErr.message }, 500);
      authUserId = created.user?.id ?? null;
    } else {
      // Send an invite email — user sets their own password
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
        adminEmail,
        {
          data: {
            name: adminName,
            username: adminEmail.split('@')[0],
            role: 'admin',
          },
        }
      );
      if (inviteErr) return json({ error: inviteErr.message }, 500);
      authUserId = invited.user?.id ?? null;
      inviteSent = true;
    }

    if (!authUserId) return json({ error: 'Could not create admin user' }, 500);

    // ---- Attach profile to org + set role=admin ----
    const { error: profileErr } = await admin
      .from('profiles')
      .update({
        organization_id: updatedOrg.id,
        role: 'admin',
        name: adminName,
        username: adminEmail.split('@')[0],
        email: adminEmail,
        status: 'Active',
      })
      .eq('id', authUserId);
    if (profileErr) return json({ error: profileErr.message }, 500);

    // ---- Record who approved (audit) ----
    await admin
      .from('organizations')
      .update({ approved_by: user.id })
      .eq('id', updatedOrg.id);

    // ---- Notify the admin ----
    await admin.from('notifications').insert({
      user_id: authUserId,
      role: 'admin',
      organization_id: updatedOrg.id,
      type: 'approval',
      title: 'Welcome to Umhlaba Wami',
      message: `Your organisation ${updatedOrg.company_name} is approved. Your org code is ${updatedOrg.organization_code}.`,
    });

    return json({
      success: true,
      organizationId: updatedOrg.id,
      organizationCode: updatedOrg.organization_code,
      adminUserId: authUserId,
      inviteSent,
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
