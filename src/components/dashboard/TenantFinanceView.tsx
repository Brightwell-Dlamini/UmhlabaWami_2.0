import React, { useMemo } from 'react';
import {
  DollarSign,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { invoices as invoicesApi } from '../../services/api/invoices';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { leases as leasesApi } from '../../services/api/leases';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { generateInvoicePdf } from '../../services/pdf';
import type { Invoice } from '../../types';

/**
 * Tenant-facing financial snapshot: open balance, invoices, rent obligations.
 * Read-only — tenants never mutate finance records from this view.
 */
export const TenantFinanceView: React.FC = () => {
  const user = auth.getCurrentUser();
  const org = auth.getCurrentOrganization();
  const orgId = user?.organization_id ?? org?.id ?? '';

  const { data: tenants = [] } = useSupabaseQuery(
    ['tenants', orgId],
    () => tenantsApi.list(),
    { enabled: !!orgId }
  );
  const { data: invoices = [] } = useSupabaseQuery(
    ['invoices', orgId],
    () => invoicesApi.list(),
    { enabled: !!orgId }
  );
  const { data: leases = [] } = useSupabaseQuery(
    ['leases', orgId],
    () => leasesApi.list(),
    { enabled: !!orgId }
  );

  const myTenant = useMemo(() => {
    if (!user) return undefined;
    return (
      tenants.find((t) => t.user_id === user.id) ??
      tenants.find(
        (t) =>
          t.email &&
          user.email &&
          t.email.toLowerCase() === user.email.toLowerCase()
      ) ??
      (user.shop_id ? tenants.find((t) => t.shop_id === user.shop_id) : undefined)
    );
  }, [tenants, user]);

  const myInvoices = useMemo(
    () =>
      myTenant
        ? invoices.filter((inv) => inv.tenant_id === myTenant.id)
        : [],
    [invoices, myTenant]
  );

  const myLease = useMemo(
    () =>
      myTenant
        ? leases.find(
            (l) =>
              l.tenant_id === myTenant.id &&
              (l.renewal_status === 'Active' ||
                l.renewal_status === 'Pending Renewal')
          )
        : undefined,
    [leases, myTenant]
  );

  const openBalance = useMemo(
    () =>
      myInvoices
        .filter((inv) => inv.status !== 'Paid' && inv.status !== 'Cancelled')
        .reduce(
          (sum, inv) =>
            sum +
            Math.max(0, Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0)),
          0
        ),
    [myInvoices]
  );

  const paidYtd = useMemo(() => {
    const year = new Date().getFullYear();
    return myInvoices
      .filter(
        (inv) =>
          inv.status === 'Paid' &&
          inv.issue_date &&
          new Date(inv.issue_date).getFullYear() === year
      )
      .reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);
  }, [myInvoices]);

  const handleViewPdf = (inv: Invoice) => {
    if (!org) return;
    void generateInvoicePdf(inv, org, myTenant, { open: true });
  };

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">No organisation context.</div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold">My finances</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Rent, invoices and balance for{' '}
          {myTenant?.business_name ?? 'your tenancy'}
        </p>
      </div>

      {!myTenant && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Your account is not linked to a tenant record yet. Once linked by
            your organisation admin, invoices and balances will appear here.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border">
          <div className="text-[10px] uppercase font-semibold text-slate-400">
            Open balance
          </div>
          <div
            className={`text-2xl font-bold mt-1 ${
              openBalance > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            E{openBalance.toLocaleString()}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border">
          <div className="text-[10px] uppercase font-semibold text-slate-400">
            Paid this year
          </div>
          <div className="text-2xl font-bold mt-1">
            E{paidYtd.toLocaleString()}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border">
          <div className="text-[10px] uppercase font-semibold text-slate-400">
            Contracted rent
          </div>
          <div className="text-2xl font-bold mt-1">
            {myLease
              ? `E${myLease.rental_amount.toLocaleString()}/mo`
              : '—'}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Receipt className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold">Invoices sent to you</h2>
        </div>
        {myInvoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No invoices yet.
          </div>
        ) : (
          <div className="divide-y">
            {myInvoices.map((inv) => {
              const isPaid = inv.status === 'Paid';
              const balance =
                Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0);
              const isOverdue =
                !isPaid &&
                inv.due_date &&
                new Date(inv.due_date).getTime() < Date.now();
              const total = Number(inv.total ?? 0);
              return (
                <div
                  key={inv.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {inv.invoice_number ?? inv.type ?? 'Invoice'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Issued {inv.issue_date}
                      {inv.due_date ? ` · Due ${inv.due_date}` : ''}
                      {!isPaid && balance > 0
                        ? ` · Balance E${balance.toLocaleString()}`
                        : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div>
                      <div className="font-bold">
                        E{total.toLocaleString()}
                      </div>
                      <div
                        className={`text-[10px] font-bold flex items-center justify-end gap-1 mt-0.5 ${
                          isPaid
                            ? 'text-emerald-600'
                            : isOverdue
                              ? 'text-red-600'
                              : 'text-amber-600'
                        }`}
                      >
                        {isPaid ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {isPaid ? 'Paid' : isOverdue ? 'Overdue' : inv.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleViewPdf(inv)}
                      className="px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-1"
                      title="View invoice PDF"
                    >
                      <FileText className="w-3.5 h-3.5" /> View PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
