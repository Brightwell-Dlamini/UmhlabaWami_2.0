import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { FinancialRequest } from '../../types';
import { notifications } from './notifications';

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
    const user = requireUser();
    const result = await sb()
      .from('financial_requests')
      .insert({
        organization_id: requireOrgId(),
        status: 'Pending Approval',
        ...input,
      })
      .select()
      .single();
    const row = unwrap(result) as unknown as FinancialRequest;

    try {
      await notifications.notifyFinance(
        {
          title: 'New requisition',
          message: `${input.requested_by_name || user.name} requested E${Number(input.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} — ${input.purpose}`,
          type: 'announcement',
          link: row.id,
        },
        user.id
      );
    } catch (e) {
      console.warn('[financialRequests] notify create failed', e);
    }

    return row;
  },

  async approve(id: string): Promise<FinancialRequest> {
    const user = requireUser();
    const { data, error } = await sb().rpc('approve_requisition', {
      p_request_id: id,
      p_approver_name: user.name,
    });
    if (error) throw new Error(error.message);
    const row = data as unknown as FinancialRequest;

    try {
      await notifications.notifyManagers(
        {
          title: 'Requisition approved',
          message: `${user.name} approved a requisition of E${Number(row.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          type: 'announcement',
          link: id,
        },
        user.id
      );
    } catch (e) {
      console.warn('[financialRequests] notify approve failed', e);
    }

    return row;
  },

  async disburse(id: string): Promise<FinancialRequest> {
    const user = requireUser();
    const { data, error } = await sb().rpc('disburse_requisition', {
      p_request_id: id,
      p_actor_name: user.name,
    });
    if (error) throw new Error(error.message);
    const row = data as unknown as FinancialRequest;

    try {
      await notifications.notifyFinance(
        {
          title: 'Requisition disbursed',
          message: `${user.name} disbursed E${Number(row.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          type: 'announcement',
          link: id,
        },
        user.id
      );
    } catch (e) {
      console.warn('[financialRequests] notify disburse failed', e);
    }

    return row;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('financial_requests').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
