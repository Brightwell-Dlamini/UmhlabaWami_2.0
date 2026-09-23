import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { Lease } from '../../types';

export interface LeaseInput {
  tenant_id: string;
  shop_id: string;
  start_date: string;
  end_date: string;
  rental_amount: number;
  deposit: number;
  renewal_status: Lease['renewal_status'];
  document_title: string;
  document_url?: string;
  terms_body?: string;
}

/** Fields allowed to PATCH — never send unknown keys to PostgREST. */
const LEASE_PATCH_KEYS = [
  'tenant_id',
  'shop_id',
  'start_date',
  'end_date',
  'rental_amount',
  'deposit',
  'renewal_status',
  'document_title',
  'document_url',
  'terms_body',
  'is_digitally_signed',
  'signed_at',
  'signer_name',
  'last_reminder_sent',
] as const;

function pickLeasePatch(
  patch: Partial<Lease> | Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of LEASE_PATCH_KEYS) {
    if (key in patch && (patch as Record<string, unknown>)[key] !== undefined) {
      out[key] = (patch as Record<string, unknown>)[key];
    }
  }
  return out;
}

export const leases = {
  async list(orgId = requireOrgId()): Promise<Lease[]> {
    const result = await sb()
      .from('leases')
      .select('*')
      .eq('organization_id', orgId)
      .order('end_date', { ascending: true });
    return unwrap(result) as unknown as Lease[];
  },

  async get(id: string): Promise<Lease> {
    const result = await sb()
      .from('leases')
      .select('*')
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as Lease;
  },

  async create(input: LeaseInput): Promise<Lease> {
    const orgId = requireOrgId();
    const base = {
      organization_id: orgId,
      tenant_id: input.tenant_id,
      shop_id: input.shop_id,
      start_date: input.start_date,
      end_date: input.end_date,
      rental_amount: input.rental_amount,
      deposit: input.deposit,
      renewal_status: input.renewal_status,
      document_title: input.document_title,
      document_url: input.document_url ?? '',
      is_digitally_signed: false,
    };
    const withTerms = {
      ...base,
      terms_body: input.terms_body ?? null,
    };
    let result = await sb().from('leases').insert(withTerms).select('*').single();
    if (result.error && /terms_body/i.test(result.error.message || '')) {
      const fallback = {
        ...base,
        document_url:
          input.document_url ||
          (input.terms_body ? `terms:\n${input.terms_body}` : ''),
      };
      result = await sb().from('leases').insert(fallback).select('*').single();
    }
    return unwrap(result) as unknown as Lease;
  },

  async update(
    id: string,
    patch: Partial<Lease> | Record<string, unknown>
  ): Promise<Lease> {
    const clean = pickLeasePatch(patch);
    if (Object.keys(clean).length === 0) {
      return this.get(id);
    }
    let result = await sb()
      .from('leases')
      .update(clean)
      .eq('id', id)
      .select('*')
      .single();
    if (
      result.error &&
      /terms_body/i.test(result.error.message || '') &&
      'terms_body' in clean
    ) {
      const { terms_body, ...rest } = clean;
      if (typeof terms_body === 'string' && terms_body) {
        rest.document_url = `terms:\n${terms_body}`;
      }
      result = await sb()
        .from('leases')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
    }
    return unwrap(result) as unknown as Lease;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('leases').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /**
   * Only the tenant linked to this lease may sign.
   * Staff/admin cannot "Mark signed" on behalf of the tenant.
   */
  async sign(id: string, signerName: string): Promise<Lease> {
    const user = requireUser();
    const lease = await this.get(id);

    if (lease.is_digitally_signed) {
      throw new Error('This lease is already signed.');
    }

    // Resolve tenant row and verify the caller owns it.
    const { data: tenant, error: tErr } = await sb()
      .from('tenants')
      .select('id, user_id, email, contact_person')
      .eq('id', lease.tenant_id)
      .single();
    if (tErr || !tenant) {
      throw new Error('Tenant record for this lease was not found.');
    }

    const linked =
      tenant.user_id === user.id ||
      (tenant.email &&
        user.email &&
        tenant.email.toLowerCase() === user.email.toLowerCase());

    if (!linked || user.role !== 'tenant') {
      throw new Error(
        'Only the tenant on this lease can digitally sign it. Staff cannot sign on their behalf.'
      );
    }

    const name =
      signerName?.trim() || user.name || tenant.contact_person || 'Tenant';

    const { data, error } = await sb().rpc('sign_lease', {
      p_lease_id: id,
      p_signer_name: name,
    });
    if (!error && data) {
      return data as unknown as Lease;
    }
    return this.update(id, {
      is_digitally_signed: true,
      signed_at: new Date().toISOString(),
      signer_name: name,
    });
  },
};
