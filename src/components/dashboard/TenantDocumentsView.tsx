import React, { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  FileCheck,
  ShieldCheck,
  Calendar,
  AlertTriangle,
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
    const myTenant = tenants.find((t) => t.user_id === currentUser.id);
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

  if (!orgId || !currentUser) {
    return (
      <div className="p-6 text-slate-500 text-sm">No organisation context.</div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Compliance &amp; Tenancy Documents
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
        <div className="bg-white dark:bg-slate-800 rounded-2
