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
    const { data, error } = await sb().rpc('add_lease', {
      p_organization_id: orgId,
      p_tenant_id: input.tenant_id,
      p_shop_id: input.shop_id,
      p_start_date: input.start_date,
      p_end_date: input.end_date,
      p_rental_amount: input.rental_amount,
      p_deposit: input.deposit,
      p_document_title: input.document_title,
      p_document_url: input.document_url ?? null,
      p_renewal_status: input.renewal_status,
    });
    if (error) throw new Error(error.message);
    let lease = data as unknown as Lease;
    if (input.terms_body) {
      lease = await this.update(lease.id, {
        terms_body: input.terms_body,
      } as Partial<Lease>);
    }
    return lease;
  },

  async update(id: string, patch: Partial<Lease>): Promise<Lease> {
    const result = await sb()
      .from('leases')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Lease;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('leases').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async sign(id: string, signerName: string): Promise<Lease> {
    const { data, error } = await sb().rpc('sign_lease', {
      p_lease_id: id,
      p_signer_name: signerName,
    });
    if (error) throw new Error(error.message);
    return data as unknown as Lease;
  },
};
