import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateInvoicePdf(invoice: Invoice, org: Organization, tenant: Tenant): void
export function generateQuotePdf(quote: Quote, org: Organization): void
export function generateStatementPdf(statement: Statement, tenant: Tenant, invoices: Invoice[], payments: PaymentRecord[]): void
