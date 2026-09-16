import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Organization,
  Invoice,
  Lease,
  Tenant,
  PaymentRecord,
} from '../types';
import type { Quote, Statement } from './api/accounting';

// ---------- shared helpers ----------

const BRAND_FALLBACK = '#2563eb';

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const full = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function formatMoney(n: number, currency = 'SZL'): string {
  const prefix = currency === 'SZL' ? 'E' : `${currency} `;
  return `${prefix}${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface DocumentHeaderArgs {
  doc: jsPDF;
  org: Organization;
  documentTitle: string;
  documentNumber: string;
  issueDate: string;
  dueDate?: string;
}

/**
 * Draw the org header block. Returns the Y position after the header.
 * Also draws the accent bar and the document title.
 */
function drawHeader({
  doc,
  org,
  documentTitle,
  documentNumber,
  issueDate,
  dueDate,
}: DocumentHeaderArgs): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const accent = hexToRgb(org.custom_branding_color || BRAND_FALLBACK);

  // Accent bar at the very top
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageWidth, 6, 'F');

  let y = 20;

  // Org name + details (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(org.company_name || 'Umhlaba Wami', 20, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (org.address) {
    doc.text(org.address, 20, y);
    y += 4;
  }
  if (org.phone || org.email) {
    doc.text([org.phone, org.email].filter(Boolean).join('  •  '), 20, y);
    y += 4;
  }
  if (org.organization_code) {
    doc.setFont('courier', 'normal');
    doc.text(`Org code: ${org.organization_code}`, 20, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
  }

  // Document title + number (right)
  const rightX = pageWidth - 20;
  let ry = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(documentTitle, rightX, ry, { align: 'right' });
  ry += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(documentNumber, rightX, ry, { align: 'right' });
  ry += 5;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Issued: ${issueDate}`, rightX, ry, { align: 'right' });
  ry += 4;
  if (dueDate) {
    doc.text(`Due: ${dueDate}`, rightX, ry, { align: 'right' });
    ry += 4;
  }

  y = Math.max(y, ry) + 8;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);

  return y + 6;
}

interface PartyBlockArgs {
  doc: jsPDF;
  x: number;
  y: number;
  label: string;
  lines: (string | undefined | null)[];
}

function drawPartyBlock({ doc, x, y, label, lines }: PartyBlockArgs): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  for (const line of lines) {
    if (!line) continue;
    doc.text(line, x, y);
    y += 4.5;
  }
  return y;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_amount: number;
  tax_rate?: number;
  amount: number;
}

interface TotalsArgs {
  doc: jsPDF;
  y: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid?: number;
  currency?: string;
}

function drawTotals({
  doc,
  y,
  subtotal,
  taxAmount,
  total,
  amountPaid,
  currency = 'SZL',
}: TotalsArgs): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightEdge = pageWidth - 20;
  const labelX = rightEdge - 60;
  const valueX = rightEdge;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);

  doc.text('Subtotal', labelX, y);
  doc.text(formatMoney(subtotal, currency), valueX, y, { align: 'right' });
  y += 5;

  doc.text('Tax', labelX, y);
  doc.text(formatMoney(taxAmount, currency), valueX, y, { align: 'right' });
  y += 6;

  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, y - 3, valueX, y - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Total', labelX, y);
  doc.text(formatMoney(total, currency), valueX, y, { align: 'right' });
  y += 7;

  if (typeof amountPaid === 'number') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Amount paid', labelX, y);
    doc.text(formatMoney(amountPaid, currency), valueX, y, { align: 'right' });
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Balance due', labelX, y);
    doc.text(formatMoney(total - amountPaid, currency), valueX, y, { align: 'right' });
    y += 6;
  }

  return y;
}

function drawFooter(doc: jsPDF, extraLines: string[] = []) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);

    let footerY = pageHeight - 12;
    for (const line of extraLines.slice().reverse()) {
      doc.text(line, 20, footerY);
      footerY -= 4;
    }

    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - 20,
      pageHeight - 8,
      { align: 'right' }
    );
    doc.text(
      'Generated by Umhlaba Wami',
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }
}

function download(doc: jsPDF, filename: string) {
  doc.save(filename);
}

// ---------- Invoice PDF ----------

export function generateInvoicePdf(
  invoice: Invoice,
  org: Organization,
  tenant?: Tenant
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawHeader({
    doc,
    org,
    documentTitle: 'INVOICE',
    documentNumber: invoice.invoice_number,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
  });

  // Party blocks — billed to (left) and payment status (right)
  const startY = y;
  const leftY = drawPartyBlock({
    doc,
    x: 20,
    y,
    label: 'BILLED TO',
    lines: [
      invoice.tenant_name,
      tenant?.contact_person,
      tenant?.phone,
      tenant?.email,
      invoice.shop_number ? `Unit ${invoice.shop_number}` : undefined,
    ],
  });

  // Status chip (right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('STATUS', pageWidth - 20, startY, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.status, pageWidth - 20, startY + 6, { align: 'right' });

  y = leftY + 6;

  // Line items
  const lines: LineItem[] = invoice.lines?.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit_amount: l.unit_amount,
    amount: l.amount,
  })) ?? [];

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit price', 'Amount']],
    body: lines.map((l) => [
      l.description,
      String(l.quantity),
      formatMoney(l.unit_amount, invoice.currency),
      formatMoney(l.amount, invoice.currency),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: hexToRgb(org.custom_branding_color || BRAND_FALLBACK),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  });

  // @ts-expect-error — lastAutoTable is added by the plugin at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  y = drawTotals({
    doc,
    y,
    subtotal: invoice.subtotal,
    taxAmount: invoice.tax_amount,
    total: invoice.total,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
  });

  // Notes
  if (invoice.notes) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Notes', 20, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const wrapped = doc.splitTextToSize(invoice.notes, pageWidth - 40);
    doc.text(wrapped, 20, y);
  }

  drawFooter(doc, [
    'Banking: First National Bank Eswatini  •  A/C 62890123456  •  Branch 280164',
    `Payment reference: ${invoice.invoice_number}`,
  ]);

  download(doc, `Invoice-${invoice.invoice_number}.pdf`);
}

// ---------- Quote PDF ----------

export function generateQuotePdf(quote: Quote, org: Organization): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawHeader({
    doc,
    org,
    documentTitle: 'QUOTATION',
    documentNumber: quote.quote_number,
    issueDate: quote.issue_date,
    dueDate: quote.valid_until ?? undefined,
  });

  const startY = y;
  const leftY = drawPartyBlock({
    doc,
    x: 20,
    y,
    label: 'PREPARED FOR',
    lines: [
      quote.prospect_company,
      quote.prospect_name,
      quote.prospect_phone,
      quote.prospect_email,
    ],
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('STATUS', pageWidth - 20, startY, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(quote.status, pageWidth - 20, startY + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('TYPE', pageWidth - 20, startY + 14, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(quote.type, pageWidth - 20, startY + 19, { align: 'right' });

  y = leftY + 6;

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit price', 'Amount']],
    body: (quote.lines ?? []).map((l) => [
      l.description,
      String(l.quantity),
      formatMoney(l.unit_amount, quote.currency),
      formatMoney(l.amount, quote.currency),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: hexToRgb(org.custom_branding_color || BRAND_FALLBACK),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  });

  // @ts-expect-error
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  y = drawTotals({
    doc,
    y,
    subtotal: quote.subtotal,
    taxAmount: quote.tax_amount,
    total: quote.total,
    currency: quote.currency,
  });

  if (quote.terms) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Terms & Conditions', 20, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const wrapped = doc.splitTextToSize(quote.terms, pageWidth - 40);
    doc.text(wrapped, 20, y);
  }

  drawFooter(doc, [
    `This quotation is valid until ${quote.valid_until ?? 'N/A'}.`,
  ]);

  download(doc, `Quote-${quote.quote_number}.pdf`);
}

// ---------- Statement PDF ----------

interface StatementActivityRow {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export function generateStatementPdf(
  statement: Statement,
  tenant: Tenant,
  invoices: Invoice[],
  payments: PaymentRecord[],
  org: Organization
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let y = drawHeader({
    doc,
    org,
    documentTitle: 'STATEMENT',
    documentNumber: `ST-${statement.id.slice(0, 8).toUpperCase()}`,
    issueDate: statement.period_start,
    dueDate: statement.period_end,
  });

  const startY = y;
  const leftY = drawPartyBlock({
    doc,
    x: 20,
    y,
    label: 'STATEMENT FOR',
    lines: [
      tenant.business_name,
      tenant.contact_person,
      tenant.phone,
      tenant.email,
    ],
  });

  // Opening / closing balances on the right
  const rightEdge = doc.internal.pageSize.getWidth() - 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('OPENING BALANCE', rightEdge, startY, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(statement.opening_balance), rightEdge, startY + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('CLOSING BALANCE', rightEdge, startY + 14, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(statement.closing_balance), rightEdge, startY + 20, { align: 'right' });

  y = leftY + 8;

  // Build activity rows
  const rows: StatementActivityRow[] = [];
  const periodStart = new Date(statement.period_start);
  const periodEnd = new Date(statement.period_end);

  const periodInvoices = invoices
    .filter((i) => {
      const d = new Date(i.issue_date);
      return d >= periodStart && d <= periodEnd;
    })
    .map((i) => ({
      date: i.issue_date,
      reference: i.invoice_number,
      description: `Invoice issued — ${i.type}`,
      debit: i.total,
      credit: 0,
      _sort: new Date(i.issue_date).getTime(),
    }));

  const periodPayments = payments
    .filter((p) => {
      const d = new Date(p.paid_at);
      return d >= periodStart && d <= periodEnd;
    })
    .map((p) => ({
      date: p.paid_at.slice(0, 10),
      reference: p.reference ?? p.id.slice(0, 8),
      description: `Payment received — ${p.method}`,
      debit: 0,
      credit: p.amount,
      _sort: new Date(p.paid_at).getTime(),
    }));

  const combined = [...periodInvoices, ...periodPayments].sort(
    (a, b) => a._sort - b._sort
  );

  let running = statement.opening_balance;
  for (const r of combined) {
    running = running + r.debit - r.credit;
    rows.push({
      date: r.date,
      reference: r.reference,
      description: r.description,
      debit: r.debit,
      credit: r.credit,
      balance: running,
    });
  }

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']],
    body: rows.map((r) => [
      r.date,
      r.reference,
      r.description,
      r.debit ? formatMoney(r.debit) : '',
      r.credit ? formatMoney(r.credit) : '',
      formatMoney(r.balance),
    ]),
    foot: [[
      '',
      '',
      'Period totals',
      formatMoney(statement.total_invoiced),
      formatMoney(statement.total_paid),
      formatMoney(statement.closing_balance),
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: hexToRgb(org.custom_branding_color || BRAND_FALLBACK),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, textColor: [15, 23, 42] },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  });

  drawFooter(doc, [
    statement.sent_at
      ? `Sent on ${new Date(statement.sent_at).toLocaleDateString()} to ${statement.sent_to ?? tenant.email}`
      : 'Not yet sent',
  ]);

  download(
    doc,
    `Statement-${tenant.business_name.replace(/[^a-zA-Z0-9]/g, '_')}-${statement.period_start}_${statement.period_end}.pdf`
  );
}
// ---------- Lease Certificate PDF ----------


export function generateLeaseCertificatePdf(
  lease: Lease,
  org: Organization,
  tenant?: Tenant
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawHeader({
    doc,
    org,
    documentTitle: 'LEASE CERTIFICATE',
    documentNumber: lease.document_title || lease.id.slice(0, 8).toUpperCase(),
    issueDate: lease.start_date,
    dueDate: lease.end_date,
  });

  const startY = y;
  const leftY = drawPartyBlock({
    doc,
    x: 20,
    y,
    label: 'TENANT',
    lines: [
      tenant?.business_name,
      tenant?.contact_person,
      tenant?.phone,
      tenant?.email,
    ],
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('STATUS', pageWidth - 20, startY, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    lease.is_digitally_signed ? 'SIGNED' : 'PENDING SIGNATURE',
    pageWidth - 20,
    startY + 6,
    { align: 'right' }
  );

  y = leftY + 8;

  // Terms table
  const terms: [string, string][] = [
    ['Lease reference', lease.document_title || '—'],
    ['Start date', lease.start_date],
    ['End date', lease.end_date],
    ['Renewal status', lease.renewal_status],
    ['Monthly rental', `E${lease.rental_amount.toLocaleString()}`],
    ['Deposit held', `E${(lease.deposit ?? 0).toLocaleString()}`],
  ];
  if (lease.is_digitally_signed && lease.signer_name) {
    terms.push(['Signed by', lease.signer_name]);
    if (lease.signed_at) {
      terms.push([
        'Signed on',
        new Date(lease.signed_at).toLocaleDateString(),
      ]);
    }
  }

  autoTable(doc, {
    startY: y,
    head: [['Term', 'Value']],
    body: terms,
    theme: 'grid',
    headStyles: {
      fillColor: hexToRgb(org.custom_branding_color || BRAND_FALLBACK),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 20, right: 20 },
  });

  // @ts-expect-error — lastAutoTable is added by the plugin at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  if (lease.document_url) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Original document', 20, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(37, 99, 235);
    doc.textWithLink(lease.document_url, 20, y, { url: lease.document_url });
  }

  drawFooter(doc, [
    'This certificate reflects terms on file. The signed lease agreement is the legally binding document.',
  ]);

  download(
    doc,
    `Lease-Certificate-${tenant?.business_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'tenant'}.pdf`
  );
}
