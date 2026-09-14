import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { FinancialRequest } from '../../types';

export interface RequestInput {
  property_id?: string;
  requested_by_name: string;
  type: FinancialRequest['type'];
  amount: number;
  purpose: string;
}

export const financialRequests = {
  async list(orgId = requireOrgId()): Promise<FinancialRequest[]> {
    const result = await sb()
      .from('financial_requests')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as FinancialRequest[];
  },

  async create(input: RequestInput): Promise<FinancialRequest> {
    const result = await sb()
      .from('financial_requests')
      .insert({
        organization_id: requireOrgId(),
        status: 'Pending Approval',
        ...input,
      })
      .select()
      .single();
    return unwrap(result) as unknown as FinancialRequest;
  },

  async approve(id: string): Promise<FinancialRequest> {
    const user = requireUser();
    const { data, error } = await sb().rpc('approve_requisition', {
      p_request_id: id,
      p_approver_name: user.name,
    });
    if (error) throw new Error(error.message);
    return data as unknown as FinancialRequest;
  },

  async disburse(id: string): Promise<FinancialRequest> {
    const user = requireUser();
    const { data, error } = await sb().rpc('disburse_requisition', {
      p_request_id: id,
      p_actor_name: user.name,
    });
    if (error) throw new Error(error.message);
    return data as unknown as FinancialRequest;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('financial_requests').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
