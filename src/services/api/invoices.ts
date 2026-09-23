// src/services/api/invoices.ts
import { sb, unwrap, requireOrgId, requireUser, throwFriendly } from './_helpers';
import type { Invoice, InvoiceType, PaymentRecord } from '../../types';
import { isPayableStatus, isSettledStatus } from '../../constants/invoiceStatus';
import { notifications } from './notifications';
import { tenants as tenantsApi } from './tenants';
import { profiles } from './profiles';
import { uploadFile, getSignedUrl } from '../storage';

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

function endOfDayUtc(iso: string): string {
  if (iso.includes('T')) return iso;
  return `${iso}T23:59:59.999Z`;
}

function startOfDayUtc(iso: string): string {
  if (iso.includes('T')) return iso;
  return `${iso}T00:00:00.000Z`;
}

const POP_CLAIM_MARKER = 'POP_CLAIM:';

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
    if (error) throwFriendly(error);
    return data as unknown as Invoice;
  },

  /** Soft-cancel via RPC when migration 017 is applied; falls back to direct update. */
  async cancel(id: string, reason?: string): Promise<Invoice> {
    const { data, error } = await sb().rpc('cancel_invoice', {
      p_invoice_id: id,
      p_reason: reason ?? null,
    });
    if (!error && data) {
      return data as unknown as Invoice;
    }
    // Fallback if RPC not deployed yet
    if (error && !/could not find the function|function.*does not exist/i.test(error.message)) {
      throwFriendly(error);
    }

    const orgId = requireOrgId();
    const inv = await this.get(id);
    if (inv.status === 'Cancelled') {
      throw new Error('Invoice is already cancelled.');
    }
    if (inv.status === 'Paid') {
      throw new Error(
        'Paid invoices cannot be cancelled. Issue a credit note to reverse the balance.'
      );
    }
    const noteLine = reason
      ? `Cancelled: ${reason}`
      : `Cancelled on ${new Date().toISOString().slice(0, 10)}`;
    const notes = inv.notes ? `${inv.notes}\n${noteLine}` : noteLine;
    const result = await sb()
      .from('invoices')
      .update({ status: 'Cancelled', notes })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select('*, lines:invoice_lines(*)')
      .single();
    return unwrap(result) as unknown as Invoice;
  },

  async issueCreditNote(
    invoiceId: string,
    amount: number,
    reason: string
  ): Promise<PaymentRecord> {
    if (amount <= 0) throw new Error('Credit amount must be greater than zero.');
    return this.recordPayment(invoiceId, {
      amount,
      method: 'Other',
      reference: `CN-${Date.now().toString(36).toUpperCase()}`,
      notes: `CREDIT_NOTE: ${reason}`,
    });
  },

  async recordPayment(
    invoiceId: string,
    args: {
      amount: number;
      method: PaymentRecord['method'];
      reference?: string;
      notes?: string;
      proof_url?: string;
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
    if (loadErr) throwFriendly(loadErr);

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

    const notes =
      [args.notes, args.proof_url ? `POP: ${args.proof_url}` : null]
        .filter(Boolean)
        .join(' | ') || null;

    const { data, error } = await sb().rpc('record_payment', {
      p_invoice_id: invoiceId,
      p_amount: args.amount,
      p_method: args.method,
      p_reference: args.reference ?? null,
      p_notes: notes,
    });
    if (error) throwFriendly(error);
    return data as unknown as PaymentRecord;
  },

  async uploadProof(invoiceId: string, file: File): Promise<string> {
    const orgId = requireOrgId();
    const { path, publicUrl } = await uploadFile({
      bucket: 'ticket-attachments',
      organizationId: orgId,
      entityId: invoiceId,
      file,
    });
    if (publicUrl) return publicUrl;
    try {
      return await getSignedUrl('ticket-attachments', path, 60 * 60 * 24 * 30);
    } catch {
      return path;
    }
  },

  /**
   * Tenant "I paid" — prefers RPC submit_invoice_payment_claim (migration 017).
   */
  async submitPaymentClaim(
    invoiceId: string,
    args: {
      amount: number;
      method: PaymentRecord['method'];
      reference?: string;
      proof_url?: string;
      notes?: string;
    }
  ): Promise<void> {
    const actor = requireUser();
    if (actor.role !== 'tenant') {
      throw new Error('Only tenants can submit a payment claim from the portal.');
    }
    if (args.amount <= 0) {
      throw new Error('Amount must be greater than zero.');
    }

    const inv = await this.get(invoiceId);
    if (isSettledStatus(inv.status)) {
      throw new Error('This invoice is already settled.');
    }

    const { error: rpcErr } = await sb().rpc('submit_invoice_payment_claim', {
      p_invoice_id: invoiceId,
      p_amount: args.amount,
      p_method: args.method,
      p_reference: args.reference ?? null,
      p_proof_url: args.proof_url ?? null,
      p_notes: args.notes ?? null,
    });

    if (rpcErr) {
      const missing = /could not find the function|function.*does not exist/i.test(
        rpcErr.message || ''
      );
      if (!missing) throwFriendly(rpcErr);

      // Fallback: direct notes update (needs RLS to allow tenant update)
      const claim = {
        at: new Date().toISOString(),
        by: actor.name,
        amount: args.amount,
        method: args.method,
        reference: args.reference ?? '',
        proof_url: args.proof_url ?? '',
        notes: args.notes ?? '',
      };
      const claimLine = `${POP_CLAIM_MARKER}${JSON.stringify(claim)}`;
      const notes = inv.notes ? `${inv.notes}\n${claimLine}` : claimLine;
      const { error } = await sb()
        .from('invoices')
        .update({ notes })
        .eq('id', invoiceId);
      if (error) throwFriendly(error);
    }

    try {
      const staff = await profiles.list();
      const targets = staff.filter(
        (u) =>
          u.status === 'Active' &&
          (u.role === 'finance' || u.role === 'admin' || u.role === 'property_manager')
      );
      for (const u of targets) {
        await notifications.create({
          user_id: u.id,
          title: `Payment claim — ${inv.invoice_number}`,
          message: `${actor.name} reported E${args.amount.toLocaleString()} paid (${args.method}${args.reference ? `, ref ${args.reference}` : ''}). Review and record payment.`,
          type: 'lease_reminder',
          link: inv.id,
        });
      }
    } catch (e) {
      console.warn('[invoices] notify staff of POP claim failed', e);
    }
  },

  parseLatestClaim(notes?: string | null): {
    at: string;
    by: string;
    amount: number;
    method: string;
    reference: string;
    proof_url: string;
    notes: string;
  } | null {
    if (!notes) return null;
    const lines = notes.split('\n').filter((l) => l.startsWith(POP_CLAIM_MARKER));
    if (!lines.length) return null;
    try {
      return JSON.parse(lines[lines.length - 1].slice(POP_CLAIM_MARKER.length));
    } catch {
      return null;
    }
  },

  async bulkGenerateRent(periodDate: string, taxRate = 0): Promise<number> {
    const { data, error } = await sb().rpc('bulk_generate_rent_invoices', {
      p_organization_id: requireOrgId(),
      p_period_date: periodDate,
      p_tax_rate: taxRate,
    });
    if (error) throwFriendly(error);
    return (data as number) ?? 0;
  },

  async remove(id: string): Promise<void> {
    const orgId = requireOrgId();

    const { count: payCount, error: payErr } = await sb()
      .from('payment_records')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', id);
    if (payErr) throwFriendly(payErr);

    if ((payCount ?? 0) > 0) {
      throw new Error(
        `Cannot delete this invoice: ${payCount} payment record(s) are linked to it. ` +
          'Cancel the invoice or reverse those payments if you need to correct the books.'
      );
    }

    const { error: lineErr } = await sb()
      .from('invoice_lines')
      .delete()
      .eq('invoice_id', id);
    if (lineErr) throwFriendly(lineErr);

    const { error } = await sb()
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);
    if (error) throwFriendly(error);
  },

  async paymentsForInvoice(invoiceId: string): Promise<PaymentRecord[]> {
    const result = await sb()
      .from('payment_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false });
    return unwrap(result) as unknown as PaymentRecord[];
  },

  async sendReminders(invoiceIds: string[]): Promise<number> {
    if (!invoiceIds.length) return 0;
    const actor = requireUser();
    const orgId = requireOrgId();

    const { data: rows, error } = await sb()
      .from('invoices')
      .select('id, invoice_number, tenant_id, tenant_name, total, amount_paid, due_date, status')
      .in('id', invoiceIds)
      .eq('organization_id', orgId);
    if (error) throwFriendly(error);

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
