import { sb, unwrap, requireOrgId, requireUser, throwFriendly } from './_helpers';
import type { Invoice, PaymentRecord } from '../../types';

// ---------- Types ----------
export interface InvoiceItem {
  id: string;
  organization_id: string;
  code: string | null;
  name: string;
  description: string | null;
  unit_price: number;
  tax_rate: number;
  default_quantity: number;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_amount: number;
  tax_rate: number;
  amount: number;
  line_order: number;
}

export interface Quote {
  id: string;
  organization_id: string;
  quote_number: string;
  type: 'Lease Proposal' | 'Fitout Works' | 'Once-off Service' | 'Other';
  tenant_id: string | null;
  prospect_name: string | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  prospect_company: string | null;
  shop_id: string | null;
  issue_date: string;
  valid_until: string | null;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired' | 'Converted';
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  salesperson_id: string | null;
  salesperson_name: string | null;
  converted_invoice_id: string | null;
  converted_at: string | null;
  created_at: string;
  lines?: QuoteLine[];
}

export interface SalesOrder {
  id: string;
  organization_id: string;
  order_number: string;
  tenant_id: string | null;
  shop_id: string | null;
  order_date: string;
  due_date: string | null;
  status: 'Draft' | 'Confirmed' | 'In Progress' | 'Fulfilled' | 'Cancelled' | 'Invoiced';
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  salesperson_id: string | null;
  salesperson_name: string | null;
  converted_invoice_id: string | null;
  converted_at: string | null;
  created_at: string;
}

export interface Statement {
  id: string;
  organization_id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_invoiced: number;
  total_paid: number;
  generated_at: string;
  sent_at: string | null;
  sent_to: string | null;
}

export interface PaymentReminder {
  id: string;
  organization_id: string;
  invoice_id: string;
  reminder_type: 'Friendly' | 'Firm' | 'Final Notice';
  sent_at: string;
  sent_to: string | null;
  channel: 'email' | 'sms' | 'print';
  notes: string | null;
}

// ---------- ITEMS CATALOG ----------
export const items = {
  async list(orgId = requireOrgId()): Promise<InvoiceItem[]> {
    const result = await sb()
      .from('invoice_items')
      .select('*')
      .eq('organization_id', orgId)
      .order('name');
    return unwrap(result) as unknown as InvoiceItem[];
  },

  async active(orgId = requireOrgId()): Promise<InvoiceItem[]> {
    const result = await sb()
      .from('invoice_items')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name');
    return unwrap(result) as unknown as InvoiceItem[];
  },

  async create(input: {
    code?: string;
    name: string;
    description?: string;
    unit_price: number;
    tax_rate?: number;
    default_quantity?: number;
    category?: string;
  }): Promise<InvoiceItem> {
    const result = await sb()
      .from('invoice_items')
      .insert({
        organization_id: requireOrgId(),
        tax_rate: input.tax_rate ?? 0,
        default_quantity: input.default_quantity ?? 1,
        is_active: true,
        code: input.code ?? null,
        name: input.name,
        description: input.description ?? null,
        unit_price: input.unit_price,
        category: input.category ?? null,
      })
      .select()
      .single();
    return unwrap(result) as unknown as InvoiceItem;
  },

  async update(id: string, patch: Partial<InvoiceItem>): Promise<InvoiceItem> {
    const result = await sb()
      .from('invoice_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as InvoiceItem;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('invoice_items').delete().eq('id', id);
    if (error) throwFriendly(error);
  },
};

// ---------- QUOTES ----------
export const quotes = {
  async list(orgId = requireOrgId()): Promise<Quote[]> {
    const result = await sb()
      .from('quotes')
      .select('*, lines:quote_lines(*)')
      .eq('organization_id', orgId)
      .order('issue_date', { ascending: false });
    return unwrap(result) as unknown as Quote[];
  },

  async get(id: string): Promise<Quote> {
    const result = await sb()
      .from('quotes')
      .select('*, lines:quote_lines(*)')
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as Quote;
  },

  async create(input: {
    type: Quote['type'];
    tenant_id?: string;
    prospect_name?: string;
    prospect_email?: string;
    prospect_phone?: string;
    prospect_company?: string;
    shop_id?: string;
    issue_date: string;
    valid_until?: string;
    currency?: string;
    lines: {
      item_id?: string;
      description: string;
      quantity: number;
      unit_amount: number;
      tax_rate?: number;
      line_order?: number;
    }[];
    notes?: string;
    terms?: string;
  }): Promise<Quote> {
    const lines = input.lines.map((l) => ({
      ...l,
      tax_rate: l.tax_rate ?? 0,
    }));
    const { data, error } = await sb().rpc('create_quote_with_lines', {
      p_organization_id: requireOrgId(),
      p_type: input.type,
      p_tenant_id: input.tenant_id ?? null,
      p_prospect_name: input.prospect_name ?? null,
      p_prospect_email: input.prospect_email ?? null,
      p_prospect_phone: input.prospect_phone ?? null,
      p_prospect_company: input.prospect_company ?? null,
      p_shop_id: input.shop_id ?? null,
      p_issue_date: input.issue_date,
      p_valid_until: input.valid_until ?? null,
      p_currency: input.currency ?? 'SZL',
      p_lines: lines,
      p_notes: input.notes ?? null,
      p_terms: input.terms ?? null,
    });
    if (error) throwFriendly(error);
    return data as unknown as Quote;
  },

  async update(id: string, patch: Partial<Quote>): Promise<Quote> {
    const result = await sb()
      .from('quotes')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Quote;
  },

  async convertToInvoice(id: string): Promise<Invoice> {
    const { data, error } = await sb().rpc('convert_quote_to_invoice', { p_quote_id: id });
    if (error) throwFriendly(error);
    return data as unknown as Invoice;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('quotes').delete().eq('id', id);
    if (error) throwFriendly(error);
  },
};

// ---------- SALES ORDERS ----------
export const salesOrders = {
  async list(orgId = requireOrgId()): Promise<SalesOrder[]> {
    const result = await sb()
      .from('sales_orders')
      .select('*')
      .eq('organization_id', orgId)
      .order('order_date', { ascending: false });
    return unwrap(result) as unknown as SalesOrder[];
  },

  async create(input: {
    tenant_id: string;
    shop_id?: string;
    order_date: string;
    due_date?: string;
    notes?: string;
    lines: {
      item_id?: string;
      description: string;
      quantity: number;
      unit_amount: number;
      tax_rate?: number;
    }[];
  }): Promise<SalesOrder> {
    const orgId = requireOrgId();
    const user = requireUser();
    const subtotal = input.lines.reduce(
      (s, l) => s + l.quantity * l.unit_amount,
      0
    );
    const tax = input.lines.reduce(
      (s, l) => s + l.quantity * l.unit_amount * (l.tax_rate ?? 0),
      0
    );

    const { data: numData, error: numErr } = await sb().rpc('generate_order_number', {
      p_org_id: orgId,
    });
    if (numErr) throwFriendly(numErr);

    const result = await sb()
      .from('sales_orders')
      .insert({
        organization_id: orgId,
        order_number: numData as string,
        tenant_id: input.tenant_id,
        shop_id: input.shop_id ?? null,
        order_date: input.order_date,
        due_date: input.due_date ?? null,
        notes: input.notes ?? null,
        subtotal,
        tax_amount: tax,
        total: subtotal + tax,
        salesperson_id: user.id,
        salesperson_name: user.name,
      })
      .select()
      .single();
    const order = unwrap(result) as unknown as SalesOrder;

    for (let i = 0; i < input.lines.length; i++) {
      const l = input.lines[i];
      await sb().from('sales_order_lines').insert({
        order_id: order.id,
        item_id: l.item_id ?? null,
        description: l.description,
        quantity: l.quantity,
        unit_amount: l.unit_amount,
        tax_rate: l.tax_rate ?? 0,
        amount: l.quantity * l.unit_amount,
        line_order: i,
      });
    }

    return order;
  },

  async updateStatus(id: string, status: SalesOrder['status']): Promise<SalesOrder> {
    const result = await sb()
      .from('sales_orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as SalesOrder;
  },

  async convertToInvoice(id: string): Promise<Invoice> {
    const { data, error } = await sb().rpc('convert_order_to_invoice', { p_order_id: id });
    if (error) throwFriendly(error);
    return data as unknown as Invoice;
  },
};

// ---------- STATEMENTS ----------
export const statements = {
  async list(orgId = requireOrgId()): Promise<Statement[]> {
    const result = await sb()
      .from('statements')
      .select('*')
      .eq('organization_id', orgId)
      .order('generated_at', { ascending: false });
    return unwrap(result) as unknown as Statement[];
  },

  async generate(tenantId: string, periodStart: string, periodEnd: string): Promise<Statement> {
    const { data, error } = await sb().rpc('generate_statement', {
      p_tenant_id: tenantId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (error) throwFriendly(error);
    return data as unknown as Statement;
  },

  async markSent(id: string, sentTo: string): Promise<Statement> {
    const result = await sb()
      .from('statements')
      .update({ sent_at: new Date().toISOString(), sent_to: sentTo })
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Statement;
  },
};

// ---------- PAYMENT REMINDERS ----------
export const reminders = {
  async listForInvoice(invoiceId: string): Promise<PaymentReminder[]> {
    const result = await sb()
      .from('payment_reminders')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sent_at', { ascending: false });
    return unwrap(result) as unknown as PaymentReminder[];
  },

  async record(input: {
    invoice_id: string;
    reminder_type: PaymentReminder['reminder_type'];
    sent_to: string;
    channel: PaymentReminder['channel'];
    notes?: string;
  }): Promise<PaymentReminder> {
    const result = await sb()
      .from('payment_reminders')
      .insert({
        organization_id: requireOrgId(),
        ...input,
      })
      .select()
      .single();
    return unwrap(result) as unknown as PaymentReminder;
  },

  async sendReminder(invoiceId: string): Promise<PaymentReminder> {
    const inv = await sb().from('invoices').select('*').eq('id', invoiceId).single();
    if (inv.error) throwFriendly(inv.error);
    const invoice = inv.data;

    const daysOverdue = Math.floor(
      (Date.now() - new Date(invoice.due_date).getTime()) / 86400000
    );
    const type: PaymentReminder['reminder_type'] =
      daysOverdue > 30 ? 'Final Notice' :
      daysOverdue > 7 ? 'Firm' : 'Friendly';

    return this.record({
      invoice_id: invoiceId,
      reminder_type: type,
      sent_to: invoice.tenant_name,
      channel: 'email',
    });
  },
};

// ---------- EXTENDED INVOICE HELPERS ----------
export const invoiceExtensions = {
  async attributeSalesperson(invoiceId: string, salespersonName: string): Promise<void> {
    const { error } = await sb()
      .from('invoices')
      .update({ salesperson_name: salespersonName })
      .eq('id', invoiceId);
    if (error) throwFriendly(error);
  },

  async overdue(orgId = requireOrgId()): Promise<Invoice[]> {
    const result = await sb()
      .from('invoices')
      .select('*, lines:invoice_lines(*)')
      .eq('organization_id', orgId)
      .in('status', ['Sent', 'Partially Paid', 'Overdue'])
      .lt('due_date', new Date().toISOString().slice(0, 10))
      .order('due_date', { ascending: true });
    return unwrap(result) as unknown as Invoice[];
  },
};
