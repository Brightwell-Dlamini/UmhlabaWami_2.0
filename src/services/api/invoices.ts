// src/services/api/invoices.ts
import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { Invoice, InvoiceType, PaymentRecord } from '../../types';
import { isPayableStatus, isSettledStatus } from '../../constants/invoiceStatus';
import { notifications } from './notifications';
import { tenants as tenantsApi } from './tenants';

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
  /** Explicit tax rate (0–1). Defaults to 0 — never assume VAT. */
  tax_rate?: number;
  lines: InvoiceLineInput[];
  notes?: string;
}

function endOfDayUtc(iso: string): string {
  if (iso.includes('T')) return iso;
  return `${iso}T23:59:59.999Z`;
}

function startOfDayUtc(iso: string): string {
  if (iso.includes('T')) return iso;
  return `${iso}T00:00:00.000Z`;
}

export const invoices = {
  async list(orgId = requireOrgId()): Promise<Invoice[]> {
    const result = await sb()
      .from('invoices')
      .select('*, lines:invoice_lines(*)')
      .eq('organization_id', orgId)
      .order('issue_date', { ascending: false });
    return unwrap(result) as unknown as Invoice[];
  },

  async get(id: string): Promise<Invoice> {
    const result = await sb()
      .from('invoices')
      .select('*, lines:invoice_lines(*)')
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as Invoice;
  },

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    if (!input.lines || input.lines.length === 0) {
      throw new Error('An invoice must have at least one line.');
    }
    // Tax is zero unless the caller explicitly passes a rate.
    const taxRate = input.tax_rate ?? 0;
    const { data, error } = await sb().rpc('create_invoice_with_lines', {
      p_organization_id: requireOrgId(),
      p_tenant_id: input.tenant_id,
      p_type: input.type,
      p_issue_date: input.issue_date,
      p_due_date: input.due_date,
      p_currency: input.currency ?? 'SZL',
      p_tax_rate: taxRate,
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

    const { data: invRow, error: loadErr } = await sb()
      .from('invoices')
      .select('total, amount_paid, status')
      .eq('id', invoiceId)
      .single();
    if (loadErr) throw new Error(loadErr.message);

    if (isSettledStatus(String(invRow.status))) {
      throw new Error('Invoice is already settled.');
    }
    if (!isPayableStatus(String(invRow.status))) {
      throw new Error(`Cannot record payment on a ${invRow.status} invoice.`);
    }

    const remaining = Number(invRow.total) - Number(invRow.amount_paid);
    if (remaining <= 0) {
      throw new Error('Invoice has no outstanding balance.');
    }
    if (args.amount > remaining + 0.01) {
      throw new Error(
        `Payment exceeds outstanding balance (E${remaining.toFixed(2)}).`
      );
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

  /** Bulk rent — tax stays 0 unless explicitly overridden. */
  async bulkGenerateRent(periodDate: string, taxRate = 0): Promise<number> {
    const { data, error } = await sb().rpc('bulk_generate_rent_invoices', {
      p_organization_id: requireOrgId(),
      p_period_date: periodDate,
      p_tax_rate: taxRate,
    });
    if (error) throw new Error(error.message);
    return (data as number) ?? 0;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('invoices').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async paymentsForInvoice(invoiceId: string): Promise<PaymentRecord[]> {
    const result = await sb()
      .from('payment_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false });
    return unwrap(result) as unknown as PaymentRecord[];
  },

  /**
   * Send payment reminders for selected invoices.
   * Creates in-app notifications for each tenant's portal user (when linked).
   */
  async sendReminders(invoiceIds: string[]): Promise<number> {
    if (!invoiceIds.length) return 0;
    const actor = requireUser();
    const orgId = requireOrgId();

    const { data: rows, error } = await sb()
      .from('invoices')
      .select('id, invoice_number, tenant_id, tenant_name, total, amount_paid, due_date, status')
      .in('id', invoiceIds)
      .eq('organization_id', orgId);
    if (error) throw new Error(error.message);

    const allTenants = await tenantsApi.list(orgId);
    let sent = 0;

    for (const inv of rows ?? []) {
      if (inv.status === 'Paid' || inv.status === 'Cancelled') continue;
      const balance = Number(inv.total) - Number(inv.amount_paid ?? 0);
      if (balance <= 0) continue;

      const tenant = allTenants.find((t) => t.id === inv.tenant_id);
      const userId = tenant?.user_id;
      if (!userId) continue;

      const due = inv.due_date ? String(inv.due_date) : 'soon';
      await notifications.create({
        user_id: userId,
        title: `Payment reminder — ${inv.invoice_number}`,
        message: `Balance due E${balance.toLocaleString()} (due ${due}). Please arrange payment. — ${actor.name}`,
        type: 'lease_reminder',
        link: inv.id,
      });
      sent += 1;
    }

    return sent;
  },
};

export const payments = {
  async listForTenant(
    tenantId: string,
    from: string,
    to: string
  ): Promise<PaymentRecord[]> {
    const result = await sb()
      .from('payment_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('paid_at', startOfDayUtc(from))
      .lte('paid_at', endOfDayUtc(to))
      .order('paid_at', { ascending: true });
    return unwrap(result) as unknown as PaymentRecord[];
  },
};
