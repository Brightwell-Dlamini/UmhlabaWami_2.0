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

async function tenantUserId(tenantId: string): Promise<string | null> {
  try {
    const tenant = await tenantsApi.get(tenantId);
    return (tenant as { user_id?: string | null }).user_id ?? null;
  } catch {
    return null;
  }
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
    const inv = data as unknown as Invoice;

    try {
      const userId = await tenantUserId(input.tenant_id);
      if (userId) {
        await notifications.create({
          user_id: userId,
          title: `New invoice ${inv.invoice_number ?? ''}`.trim(),
          message: `You have a new invoice for E${Number(inv.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Due ${inv.due_date ?? 'soon'}.`,
          type: 'lease_reminder',
          link: inv.id,
        });
      }
    } catch (e) {
      console.warn('[invoices] notify tenant of new invoice failed', e);
    }

    return inv;
  },

  async cancel(id: string, reason?: string): Promise<Invoice> {
    const { data, error } = await sb().rpc('cancel_invoice', {
      p_invoice_id: id,
      p_reason: reason ?? null,
    });
    if (!error && data) {
      const inv = data as unknown as Invoice;
      try {
        const uid = await tenantUserId(inv.tenant_id);
        if (uid) {
          await notifications.create({
            user_id: uid,
            title: `Invoice cancelled — ${inv.invoice_number ?? ''}`,
            message: reason || 'Your invoice was cancelled by finance.',
            type: 'lease_reminder',
            link: inv.id,
          });
        }
      } catch (e) {
        console.warn('[invoices] notify cancel failed', e);
      }
      return inv;
    }
    if (error && !/could not find the function|function.*does not exist/i.test(error.message)) {
      throwFriendly(error);
    }
    const result = await sb()
      .from('invoices')
      .update({ status: 'Cancelled', notes: reason ? `Cancelled: ${reason}` : 'Cancelled' })
      .eq('id', id)
      .select()
      .single();
    const inv = unwrap(result) as unknown as Invoice;
    try {
      const uid = await tenantUserId(inv.tenant_id);
      if (uid) {
        await notifications.create({
          user_id: uid,
          title: `Invoice cancelled — ${inv.invoice_number ?? ''}`,
          message: reason || 'Your invoice was cancelled by finance.',
          type: 'lease_reminder',
          link: inv.id,
        });
      }
    } catch (e) {
      console.warn('[invoices] notify cancel failed', e);
    }
    return inv;
  },

  async issueCreditNote(invoiceId: string, amount: number, reason: string): Promise<void> {
    const { error } = await sb().rpc('record_payment', {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_method: 'Credit note',
      p_reference: reason,
      p_paid_at: new Date().toISOString(),
      p_notes: `Credit note: ${reason}`,
    });
    if (error) throwFriendly(error);

    try {
      const inv = await this.get(invoiceId);
      const uid = await tenantUserId(inv.tenant_id);
      if (uid) {
        await notifications.create({
          user_id: uid,
          title: `Credit note — ${inv.invoice_number ?? ''}`,
          message: `E${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} credit applied. ${reason}`,
          type: 'lease_reminder',
          link: invoiceId,
        });
      }
      await notifications.notifyFinance({
        title: `Credit note issued — ${inv.invoice_number ?? ''}`,
        message: `E${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} — ${reason}`,
        type: 'lease_reminder',
        link: invoiceId,
      });
    } catch (e) {
      console.warn('[invoices] notify credit failed', e);
    }
  },

  async recordPayment(
    invoiceId: string,
    amount: number,
    method: string,
    reference?: string,
    proofUrl?: string
  ): Promise<void> {
    const { error } = await sb().rpc('record_payment', {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_method: method,
      p_reference: reference ?? null,
      p_paid_at: new Date().toISOString(),
      p_notes: proofUrl ? `POP: ${proofUrl}` : null,
    });
    if (error) throwFriendly(error);

    try {
      const inv = await this.get(invoiceId);
      const uid = await tenantUserId(inv.tenant_id);
      if (uid) {
        await notifications.create({
          user_id: uid,
          title: `Payment recorded — ${inv.invoice_number ?? ''}`,
          message: `E${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} received via ${method}${reference ? ` (ref ${reference})` : ''}.`,
          type: 'lease_reminder',
          link: invoiceId,
        });
      }
    } catch (e) {
      console.warn('[invoices] notify payment failed', e);
    }
  },

  async submitPaymentClaim(
    invoiceId: string,
    args: {
      amount: number;
      method: string;
      reference?: string;
      proof_url?: string;
      notes?: string;
    }
  ): Promise<void> {
    const actor = requireUser();
    const inv = await this.get(invoiceId);

    try {
      const { error } = await sb().rpc('submit_invoice_payment_claim', {
        p_invoice_id: invoiceId,
        p_amount: args.amount,
        p_method: args.method,
        p_reference: args.reference ?? null,
        p_proof_url: args.proof_url ?? null,
        p_notes: args.notes ?? null,
      });
      if (error) throw error;
    } catch {
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
      await notifications.notifyFinance({
        title: `Payment claim — ${inv.invoice_number}`,
        message: `${actor.name} reported E${args.amount.toLocaleString()} paid (${args.method}${args.reference ? `, ref ${args.reference}` : ''}). Review and record payment.`,
        type: 'lease_reminder',
        link: inv.id,
      });
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
    if (lines.length === 0) return null;
    try {
      return JSON.parse(lines[lines.length - 1].slice(POP_CLAIM_MARKER.length));
    } catch {
      return null;
    }
  },

  async sendReminders(invoiceIds: string[]): Promise<number> {
    const actor = requireUser();
    let sent = 0;
    for (const id of invoiceIds) {
      const inv = await this.get(id);
      if (!isPayableStatus(inv.status)) continue;
      const balance = Number(inv.total) - Number(inv.amount_paid ?? 0);
      if (balance <= 0) continue;
      const userId = await tenantUserId(inv.tenant_id);
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

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('invoices').delete().eq('id', id);
    if (error) throwFriendly(error);
  },

  async uploadProof(file: File, invoiceId: string): Promise<string> {
    const path = `pop/${invoiceId}/${Date.now()}-${file.name}`;
    await uploadFile('ticket-attachments', path, file);
    return path;
  },

  async getProofUrl(path: string): Promise<string> {
    return getSignedUrl('ticket-attachments', path);
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
