// Supabase Edge Function — service role required.
// Approves a pending organisation and provisions the first admin user.
// Does NOT rely on a missing SQL RPC — all logic is inline.

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
  adminEmail?: string;
  adminName?: string;
  temporaryPassword?: string;
}

function generateOrgCode(companyName: string): string {
  const prefix = (companyName || 'ORG')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'ORG';
  const d = new Date();
  const date =
    String(d.getDate()).padStart(2, '0') +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getFullYear()).slice(-2);
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${date}-${rand}`;
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
    if (!body.organizationId) {
      return json({ error: 'organizationId required' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('*')
      .eq('id', body.organizationId)
      .single();
    if (orgErr || !org) return json({ error: 'Organization not found' }, 404);
    if (org.status === 'Active') {
      return json({ error: 'Organization already active' }, 400);
    }

    // Approve inline — no RPC dependency
    let orgCode = body.customCode?.trim().toUpperCase() || org.organization_code;
    if (!orgCode || orgCode === 'PENDING' || String(orgCode).startsWith('PENDING')) {
      orgCode = generateOrgCode(org.company_name);
    }

    const { data: clash } = await admin
      .from('organizations')
      .select('id')
      .eq('organization_code', orgCode)
      .neq('id', org.id)
      .maybeSingle();
    if (clash) {
      orgCode = generateOrgCode(org.company_name);
    }

    const { data: updatedOrg, error: updateErr } = await admin
      .from('organizations')
      .update({
        status: 'Active',
        organization_code: orgCode,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('id', body.organizationId)
      .select('*')
      .single();

    if (updateErr || !updatedOrg) {
      return json({ error: updateErr?.message || 'Failed to activate organisation' }, 500);
    }

    const adminEmail = (body.adminEmail || org.email).toLowerCase();
    const adminName = body.adminName || org.owner_name;

    let authUserId: string | null = null;
    let inviteSent = false;

    try {
      const { data: byEmail } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = byEmail?.users?.find(
        (u) => u.email?.toLowerCase() === adminEmail
      );
      if (match) authUserId = match.id;
    } catch {
      // ignore
    }

    if (!authUserId) {
      if (body.temporaryPassword) {
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
        if (inviteErr) {
          const tempPw =
            'Uw!' +
            Math.random().toString(36).slice(2, 10) +
            Math.random().toString(36).slice(2, 6).toUpperCase();
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email: adminEmail,
            password: tempPw,
            email_confirm: true,
            user_metadata: {
              name: adminName,
              username: adminEmail.split('@')[0],
              role: 'admin',
            },
          });
          if (createErr) return json({ error: inviteErr.message + ' / ' + createErr.message }, 500);
          authUserId = created.user?.id ?? null;
        } else {
          authUserId = invited.user?.id ?? null;
          inviteSent = true;
        }
      }
    }

    if (!authUserId) return json({ error: 'Could not create admin user' }, 500);

    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: authUserId,
        organization_id: updatedOrg.id,
        role: 'admin',
        name: adminName,
        username: adminEmail.split('@')[0],
        email: adminEmail,
        status: 'Active',
      },
      { onConflict: 'id' }
    );
    if (profileErr) {
      console.error('profile upsert warning', profileErr.message);
    }

    try {
      await admin.from('notifications').insert({
        user_id: authUserId,
        role: 'admin',
        organization_id: updatedOrg.id,
        type: 'approval',
        title: 'Welcome to Umhlaba Wami',
        message: `Your organisation ${updatedOrg.company_name} is approved. Your org code is ${updatedOrg.organization_code}.`,
        read: false,
      });
    } catch {
      // ignore
    }

    try {
      await admin.from('audit_logs').insert({
        organization_id: updatedOrg.id,
        user_id: user.id,
        user_name: body.approverName || 'Super Admin',
        action: 'ORG_APPROVED',
        details: `Approved ${updatedOrg.company_name} → code ${updatedOrg.organization_code}`,
      });
    } catch {
      // ignore
    }

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
