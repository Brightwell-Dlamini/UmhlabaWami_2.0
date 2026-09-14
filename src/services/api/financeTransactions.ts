import { sb, unwrap, requireOrgId } from './_helpers';
import type { FinanceTransaction } from '../../types';

export interface FinanceTxInput {
  property_id?: string;
  shop_id?: string;
  tenant_id?: string;
  ticket_id?: string;
  type: FinanceTransaction['type'];
  category?: string;
  amount: number;
  direction: FinanceTransaction['direction'];
  description: string;
  reference?: string;
  date: string;
  status?: FinanceTransaction['status'];
  reconciled?: boolean;
}

export const financeTransactions = {
  async list(orgId = requireOrgId()): Promise<FinanceTransaction[]> {
    const result = await sb()
      .from('finance_transactions')
      .select('*')
      .eq('organization_id', orgId)
      .order('date', { ascending: false });
    return unwrap(result) as unknown as FinanceTransaction[];
  },

  async byDirection(
    direction: 'income' | 'expense',
    orgId = requireOrgId()
  ): Promise<FinanceTransaction[]> {
    const result = await sb()
      .from('finance_transactions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('direction', direction)
      .order('date', { ascending: false });
    return unwrap(result) as unknown as FinanceTransaction[];
  },

  async create(input: FinanceTxInput): Promise<FinanceTransaction> {
    const result = await sb()
      .from('finance_transactions')
      .insert({
        organization_id: requireOrgId(),
        status: input.status ?? 'Approved',
        reconciled: input.reconciled ?? false,
        ...input,
      })
      .select()
      .single();
    return unwrap(result) as unknown as FinanceTransaction;
  },

  async update(id: string, patch: Partial<FinanceTransaction>): Promise<FinanceTransaction> {
    const result = await sb()
      .from('finance_transactions')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as FinanceTransaction;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('finance_transactions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
