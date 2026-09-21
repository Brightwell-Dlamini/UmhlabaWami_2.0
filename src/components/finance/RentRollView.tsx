// src/components/finance/RentRollView.tsx
import React, { useMemo, useState } from 'react';
import {
  DollarSign,
  Search,
  Download,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shops as shopsApi } from '../../services/api/shops';
import { leases as leasesApi } from '../../services/api/leases';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useRealtime } from '../../hooks/useRealtime';
import { downloadCsv } from '../../services/api/_export';

interface RentRow {
  tenantId: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  centerName: string;
  shopNumber: string;
  floor: string;
  sizeSqm: number;
  monthlyRent: number;
  deposit: number;
  leaseStart: string | null;
  leaseEnd: string | null;
  daysToExpiry: number | null;
  renewalStatus: string;
  signed: boolean;
  /** PSF = rent per square meter. */
  psf: number;
}

export function RentRollView() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [search, setSearch] = useState('');
  const [centerFilter, setCenterFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | '90' | '180' | '365'>(
    'all'
  );
  const [notice, setNotice] = useState('');

  const { data: tenants = [] } = useSupabaseQuery(
    ['tenants', orgId],
    () => tenantsApi.list(),
    { enabled: !!orgId }
  );
  const { data: shops = [] } = useSupabaseQuery(
    ['shops', orgId],
    () => shopsApi.list(),
    { enabled: !!orgId }
  );
  const { data: leases = [] } = useSupabaseQuery(
    ['leases', orgId],
    () => leasesApi.list(),
    { enabled: !!orgId }
  );
  const { data: centers = [] } = useSupabaseQuery(
    ['centers', orgId],
    () => centersApi.list(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'tenants',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['tenants'],
    enabled: !!orgId,
  });
  useRealtime({
    table: 'leases',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['leases'],
    enabled: !!orgId,
  });

  const rows: RentRow[] = useMemo(() => {
    const today = new Date();
    const todayMs = today.getTime();

    return tenants
      .filter((t) => t.status === 'Active' || t.status === 'Notice Given')
      .map((t) => {
        const shop = shops.find((s) => s.id === t.shop_id);
        const center = centers.find(
          (c) => c.id === t.shopping_center_id
        );
        const lease = leases.find((l) => l.tenant_id === t.id);

        const leaseEnd = lease?.end_date ?? null;
        const daysToExpiry = leaseEnd
          ? Math.floor(
              (new Date(leaseEnd).getTime() - todayMs) / 86_400_000
            )
          : null;

        const monthlyRent = shop?.rental_amount ?? lease?.rental_amount ?? 0;
        const sizeSqm = shop?.size_sqm ?? 0;

        return {
          tenantId: t.id,
          businessName: t.business_name,
          contactPerson: t.contact_person,
          phone: t.phone,
          centerName: center?.name ?? '—',
          shopNumber: shop?.shop_number ?? '—',
          floor: shop?.floor ?? '—',
          sizeSqm,
          monthlyRent,
          deposit: lease?.deposit ?? shop?.deposit_amount ?? 0,
          leaseStart: lease?.start_date ?? null,
          leaseEnd,
          daysToExpiry,
          renewalStatus: lease?.renewal_status ?? 'No Lease',
          signed: lease?.is_digitally_signed ?? false,
          psf: sizeSqm > 0 ? Math.round((monthlyRent / sizeSqm) * 100) / 100 : 0,
        };
      });
  }, [tenants, shops, leases, centers]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (centerFilter !== 'all' && r.centerName !== centerFilter) {
        return false;
      }
      if (expiryFilter !== 'all') {
        const days = r.daysToExpiry;
        if (days === null) return false;
        if (days < 0) return expiryFilter === 'all'; // already expired — include only in 'all'
        if (days > Number(expiryFilter)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          r.businessName.toLowerCase().includes(q) ||
          r.shopNumber.toLowerCase().includes(q) ||
          r.contactPerson.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, centerFilter, expiryFilter, search]);

  const kpis = useMemo(() => {
    const monthlyTotal = filtered.reduce((s, r) => s + r.monthlyRent, 0);
    const annualised = monthlyTotal * 12;
    const avgPsf =
      filtered.length > 0
        ? filtered.reduce((s, r) => s + r.psf, 0) / filtered.length
        : 0;
    const expiringSoon = filtered.filter(
      (r) => r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 90
    ).length;
    const unsigned = filtered.filter((r) => !r.signed).length;
    return { monthlyTotal, annualised, avgPsf, expiringSoon, unsigned };
  }, [filtered]);

  const handleExport = () => {
    downloadCsv(
      `rent-roll-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        [
          'Tenant',
          'Contact',
          'Phone',
          'Center',
          'Unit',
          'Floor',
          'Size (m²)',
          'Rent/mo (E)',
          'PSF (E/m²)',
          'Deposit (E)',
          'Lease Start',
          'Lease End',
          'Days to Expiry',
          'Renewal Status',
          'Signed',
        ],
        ...filtered.map((r) => [
          r.businessName,
          r.contactPerson,
          r.phone,
          r.centerName,
          r.shopNumber,
          r.floor,
          r.sizeSqm,
          r.monthlyRent,
          r.psf,
          r.deposit,
          r.leaseStart ?? '',
          r.leaseEnd ?? '',
          r.daysToExpiry ?? '',
          r.renewalStatus,
          r.signed ? 'Yes' : 'No',
        ]),
      ]
    );
    setNotice('Rent roll exported.');
    setTimeout(() => setNotice(''), 3000);
  };

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">
        No organisation context.
      </div>
    );
  }

  const uniqueCenters = useMemo(
    () => Array.from(new Set(rows.map((r) => r.centerName))).sort(),
    [rows]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Rent roll
          </h2>
          <p className="text-xs text-slate-500">
            Active tenants, unit rents, lease terms, and escalation signals
          </p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          type="button"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs">
          {notice}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Monthly rent" value={`E${kpis.monthlyTotal.toLocaleString()}`} />
        <Kpi label="Annualised" value={`E${kpis.annualised.toLocaleString()}`} />
        <Kpi label="Avg PSF" value={`E${kpis.avgPsf.toFixed(2)}/m²`} />
        <Kpi
          label="Expiring ≤90d"
          value={kpis.expiringSoon}
          tone={kpis.expiringSoon > 0 ? 'amber' : 'slate'}
        />
        <Kpi
          label="Unsigned leases"
          value={kpis.unsigned}
          tone={kpis.unsigned > 0 ? 'red' : 'slate'}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant, unit, contact…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          />
        </div>
        <select
          value={centerFilter}
          onChange={(e) => setCenterFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          <option value="all">All centers</option>
          {uniqueCenters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={expiryFilter}
          onChange={(e) =>
            setExpiryFilter(e.target.value as 'all' | '90' | '180' | '365')
          }
          className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          <option value="all">All expiries</option>
          <option value="90">Expires ≤ 90 days</option>
          <option value="180">Expires ≤ 180 days</option>
          <option value="365">Expires ≤ 365 days</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Tenant</th>
                <th className="px-3 py-2.5">Center / Unit</th>
                <th className="px-3 py-2.5 text-right">Size</th>
                <th className="px-3 py-2.5 text-right">Rent/mo</th>
                <th className="px-3 py-2.5 text-right">PSF</th>
                <th className="px-3 py-2.5">Lease end</th>
                <th className="px-3 py-2.5 text-right">Days</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-8 text-center text-slate-400"
                  >
                    No active tenants match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const expiryTone =
                    r.daysToExpiry === null
                      ? 'text-slate-400'
                      : r.daysToExpiry < 0
                      ? 'text-red-600 font-bold'
                      : r.daysToExpiry <= 30
                      ? 'text-red-600 font-bold'
                      : r.daysToExpiry <= 90
                      ? 'text-amber-600 font-bold'
                      : 'text-slate-600';
                  return (
                    <tr
                      key={r.tenantId}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30"
                    >
                      <td className="px-3 py-3">
                        <div className="font-bold">{r.businessName}</div>
                        <div className="text-[10px] text-slate-500">
                          {r.contactPerson} · {r.phone}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{r.centerName}</div>
                        <div className="text-[10px] text-slate-500">
                          Unit {r.shopNumber} · {r.floor}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {r.sizeSqm > 0 ? `${r.sizeSqm} m²` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold">
                        E{r.monthlyRent.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-500">
                        {r.psf > 0 ? `E${r.psf.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {r.leaseEnd ?? '—'}
                      </td>
                      <td className={`px-3 py-3 text-right ${expiryTone}`}>
                        {r.daysToExpiry !== null ? r.daysToExpiry : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold">
                            {r.renewalStatus}
                          </span>
                          {!r.signed && (
                            <span className="text-[10px] text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Unsigned
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <CalendarClock className="w-3 h-3" />
        Days-to-expiry is computed against the current date on each render.
        Expired leases remain visible under "All expiries".
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  tone?: 'slate' | 'amber' | 'red';
}) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-600'
      : tone === 'red'
      ? 'text-red-600'
      : 'text-slate-900 dark:text-white';
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

// Suppress unused-import lint when TrendingUp is not used.
void TrendingUp;
