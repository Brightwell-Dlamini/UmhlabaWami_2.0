import { sb, unwrap, requireOrgId } from './_helpers';
import type { BankTransaction } from '../../types';

export interface BankTxInput {
  date: string;
  description: string;
  amount: number;
  direction: BankTransaction['direction'];
}

export const bankTransactions = {
  async list(orgId = requireOrgId()): Promise<BankTransaction[]> {
    const result = await sb()
      .from('bank_transactions')
      .select('*')
      .eq('organization_id', orgId)
      .order('date', { ascending: false });
    return unwrap(result) as unknown as BankTransaction[];
  },

  async create(input: BankTxInput): Promise<BankTransaction> {
    const result = await sb()
      .from('bank_transactions')
      .insert({ organization_id: requireOrgId(), reconciled: false, ...input })
      .select()
      .single();
    return unwrap(result) as unknown as BankTransaction;
  },

  async reconcile(id: string, paymentId?: string): Promise<BankTransaction> {
    const { data, error } = await sb().rpc('reconcile_bank_transaction', {
      p_bank_tx_id: id,
      p_payment_id: paymentId ?? null,
    });
    if (error) throw new Error(error.message);
    return data as unknown as BankTransaction;
  },

  async unreconcile(id: string): Promise<BankTransaction> {
    const result = await sb()
      .from('bank_transactions')
      .update({ reconciled: false, matched_payment_id: null })
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as BankTransaction;
  },
};
