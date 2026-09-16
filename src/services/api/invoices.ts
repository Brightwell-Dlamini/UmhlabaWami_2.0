import { sb, unwrap, requireOrgId } from './_helpers';
import { isMemoryMode, getMemoryDb } from './mode';
import type { Invoice, InvoiceType, PaymentRecord } from '../../types';

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unit_amount: number;
}

export interface CreateInvoiceInput {
  tenant_id: string;
  type: InvoiceType;
  issue_date: string;
  due_date: string;
  currency?: string;
  tax_rate?: number;
  lines: InvoiceLineInput[];
  notes?: string;
}

export const invoices = {
  async list(orgId = requireOrgId()): Promise<Invoice[]> {
    if (isMemoryMode()) {
      // Memory mode has no invoice store yet — return empty array so the UI
      // renders its empty state cleanly instead of throwing.
      return [];
    }
    const result = await sb()
      .from('invoices')
      .select('*, lines:invoice_lines(*)')
      .eq('organization_id', orgId)
      .order('issue_date', { ascending: false });
    return unwrap(result) as unknown as Invoice[];
  },

  async get(id: string): Promise<Invoice> {
    if (isMemoryMode()) {
      throw new Error('Invoice lookup is not available in memory mode.');
    }
    const result = await sb()
      .from('invoices')
      .select('*, lines:invoice_lines(*)')
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as Invoice;
  },

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    if (isMemoryMode()) {
      throw new Error('Invoice creation is not available in memory mode.');
    }
    if (!input.lines || input.lines.length === 0) {
      throw new Error('An invoice must have at least one line.');
    }
    const { data, error } = await sb().rpc('create_invoice_with_lines', {
      p_organization_id: requireOrgId(),
      p_tenant_id: input.tenant_id,
      p_type: input.type,
      p_issue_date: input.issue_date,
      p_due_date: input.due_date,
      p_currency: input.currency ?? 'SZL',
      p_tax_rate: input.tax_rate ?? 0.15,
      p_lines: input.lines,
      p_notes: input.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return data as unknown as Invoice;
  },

  async recordPayment(
    invoiceId: string,
    args: {
      amount: number;
      method: PaymentRecord['method'];
      reference?: string;
      notes?: string;
    }
  ): Promise<PaymentRecord> {
    if (args.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
    if (isMemoryMode()) {
      throw new Error('Payment recording is not available in memory mode.');
    }
    const { data, error } = await sb().rpc('record_payment', {
      p_invoice_id: invoiceId,
      p_amount: args.amount,
      p_method: args.method,
      p_reference: args.reference ?? null,
      p_notes: args.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return data as unknown as PaymentRecord;
  },

  /**
   * Bulk-generate rent invoices for all active tenants for the given period.
   * Returns the number of invoices created.
   */
  async bulkGenerateRent(periodDate: string, taxRate = 0.15): Promise<number> {
    if (isMemoryMode()) {
      // No-op in memory mode; return 0 so the caller shows "0 generated".
      return 0;
    }
    const { data, error } = await sb().rpc('bulk_generate_rent_invoices', {
      p_organization_id: requireOrgId(),
      p_period_date: periodDate,
      p_tax_rate: taxRate,
    });
    if (error) throw new Error(error.message);
    return (data as number) ?? 0;
  },

  async remove(id: string): Promise<void> {
    if (isMemoryMode()) {
      throw new Error('Invoice deletion is not available in memory mode.');
    }
    const { error } = await sb().from('invoices').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async paymentsForInvoice(invoiceId: string): Promise<PaymentRecord[]> {
    if (isMemoryMode()) return [];
    const result = await sb()
      .from('payment_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false });
    return unwrap(result) as unknown as PaymentRecord[];
  },
};

export const payments = {
  /**
   * Payments for a tenant in a date range, inclusive.
   * `from` and `to` should be 'YYYY-MM-DD'.
   *
   * Note: we do NOT append 'T23:59:59' to `to` because `paid_at` may be a
   * DATE column, in which case a timestamp comparison fails silently.
   */
  async listForTenant(
    tenantId: string,
    from: string,
    to: string
  ): Promise<PaymentRecord[]> {
    if (isMemoryMode()) return [];
    const result = await sb()
      .from('payment_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('paid_at', from)
      .lte('paid_at', to)
      .order('paid_at', { ascending: true });
    return unwrap(result) as unknown as PaymentRecord[];
  },
};
