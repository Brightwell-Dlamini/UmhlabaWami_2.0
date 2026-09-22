import React, { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  FileCheck,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Eye,
  X,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { leases as leasesApi } from '../../services/api/leases';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { generateLeaseCertificatePdf } from '../../services/pdf';
import type { Lease, Tenant } from '../../types';

interface DocRow {
  lease: Lease;
  tenant: Tenant | undefined;
}

export const TenantDocumentsView: React.FC = () => {
  const currentUser = auth.getCurrentUser();
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';

  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reading, setReading] = useState<DocRow | null>(null);

  const { data: leases = [] } = useSupabaseQuery(
    ['leases', orgId],
    () => leasesApi.list(),
    { enabled: !!orgId }
  );
  const { data: tenants = [] } = useSupabaseQuery(
    ['tenants', orgId],
    () => tenantsApi.list(),
    { enabled: !!orgId }
  );

  const myRows: DocRow[] = useMemo(() => {
    if (!currentUser) return [];
    const myTenant =
      tenants.find((t) => t.user_id === currentUser.id) ??
      tenants.find(
        (t) =>
          t.email &&
          currentUser.email &&
          t.email.toLowerCase() === currentUser.email.toLowerCase()
      ) ??
      (currentUser.shop_id
        ? tenants.find((t) => t.shop_id === currentUser.shop_id)
        : undefined);
    if (!myTenant) return [];
    return leases
      .filter((l) => l.tenant_id === myTenant.id)
      .map((l) => ({ lease: l, tenant: myTenant }));
  }, [leases, tenants, currentUser]);

  const flash = (text: string, ms = 3000) => {
    setDownloadMsg(text);
    setTimeout(() => setDownloadMsg(null), ms);
  };

  const handleDownload = async (row: DocRow) => {
    if (!org) return;
    setBusyId(row.lease.id);
    try {
      generateLeaseCertificatePdf(row.lease, org, row.tenant);
      flash(`Downloaded lease for ${row.tenant?.business_name ?? 'your unit'}.`);
    } catch (e) {
      flash(
        e instanceof Error ? `Failed: ${e.message}` : 'Failed to generate PDF.',
        5000
      );
    } finally {
      setBusyId(null);
    }
  };

  const termsText = (lease: Lease) => {
    const body = (lease as Lease & { terms_body?: string }).terms_body;
    if (body) return body;
    const url = lease.document_url || '';
    if (url.startsWith('terms:')) return url.replace(/^terms:\n?/, '');
    return url || '';
  };

  if (!orgId || !currentUser) {
    return (
      <div className="p-6 text-slate-500 text-sm">No organisation context.</div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Compliance & Tenancy Documents
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Signed leases and tenancy agreements on file for your business
        </p>
      </div>

      {downloadMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{downloadMsg}</span>
        </div>
      )}

      {myRows.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            No documents on file
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Your lease and compliance documents will appear here once your
            property manager uploads them. If you believe this is an error,
            please contact your centre management office.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {myRows.map((row) => {
              const isSigned = row.lease.is_digitally_signed;
              const expiresSoon =
                new Date(row.lease.end_date).getTime() - Date.now() <
                90 * 86400000;
              return (
                <div
                  key={row.lease.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {row.lease.document_title}
                        </h2>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isSigned
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {isSigned ? 'Signed' : 'Pending Signature'}
                        </span>
                        {expiresSoon && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                            Expires Soon
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {row.lease.start_date} → {row.lease.end_date}
                        </span>
                        <span>•</span>
                        <span>
                          Rent: E{row.lease.rental_amount.toLocaleString()} /mo
                        </span>
                        <span>•</span>
                        <span>
                          Deposit: E{row.lease.deposit.toLocaleString()}
                        </span>
                      </div>
                      {isSigned && row.lease.signer_name && (
                        <div className="text-[11px] text-slate-400 mt-1">
                          Signed by {row.lease.signer_name}
                          {row.lease.signed_at
                            ? ` on ${new Date(
                                row.lease.signed_at
                              ).toLocaleDateString()}`
                            : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setReading(row)}
                      className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 hover:text-white text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
                      type="button"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => handleDownload(row)}
                      disabled={busyId === row.lease.id}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
                      type="button"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{busyId === row.lease.id ? 'Generating…' : 'Download'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reading && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">{reading.lease.document_title}</h3>
              <button type="button" onClick={() => setReading(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="text-[11px] text-slate-500">
              {reading.lease.start_date} → {reading.lease.end_date} · Rent E
              {reading.lease.rental_amount.toLocaleString()}/mo
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border max-h-96 overflow-y-auto">
              {termsText(reading.lease) ||
                'No full terms text on file yet. Contact your property manager.'}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReading(null)}
                className="px-4 py-2 rounded-xl border text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDownload(reading)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
