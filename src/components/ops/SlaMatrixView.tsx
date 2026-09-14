import React, { useEffect, useState } from 'react';
import { Save, Shield } from 'lucide-react';
import { auth } from '../../services/auth';
import { slaMatrix as slaApi } from '../../services/api/slaMatrix';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import type { SlaRule, TicketPriority } from '../../types';

const PRIORITIES: TicketPriority[] = ['Emergency', 'High', 'Medium', 'Low'];

export function SlaMatrixView() {
  const org = auth.getCurrentOrganization();
  const { data: existing = [] } = useSupabaseQuery(
    ['sla_matrix', org?.id ?? ''],
    () => slaApi.list(),
    { enabled: !!org?.id }
  );

  const [rules, setRules] = useState<SlaRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { setRules(existing); }, [existing]);

  const getRule = (p: TicketPriority): SlaRule =>
    rules.find((r) => r.priority === p) ?? {
      priority: p,
      response_minutes: p === 'Emergency' ? 15 : p === 'High' ? 60 : p === 'Medium' ? 240 : 1440,
      resolution_minutes: p === 'Emergency' ? 240 : p === 'High' ? 480 : p === 'Medium' ? 1440 : 4320,
    };

  const updateRule = (priority: TicketPriority, field: keyof SlaRule, value: number) => {
    setRules((prev) => {
      const found = prev.find((r) => r.priority === priority);
      if (found) return prev.map((r) => (r.priority === priority ? { ...r, [field]: value } : r));
      return [...prev, { ...getRule(priority), [field]: value }];
    });
  };

  const save = async () => {
    if (!org?.id) return;
    setSaving(true);
    setMessage(null);
    try {
      await slaApi.upsert(PRIORITIES.map((p) => getRule(p)));
      setMessage('SLA matrix saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" /> SLA Matrix
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configure response and resolution targets</p>
        </div>
        <button onClick={save} disabled={saving || !org}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save matrix'}
        </button>
      </div>

      {message && <div className="rounded-lg border bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm">{message}</div>}

      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Response (min)</th>
              <th className="px-4 py-3 font-medium">Resolution (min)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {PRIORITIES.map((p) => {
              const rule = getRule(p);
              return (
                <tr key={p}>
                  <td className="px-4 py-3 font-medium">{p}</td>
                  <td className="px-4 py-3">
                    <input type="number" value={rule.response_minutes}
                      onChange={(e) => updateRule(p, 'response_minutes', Number(e.target.value) || 0)}
                      className="w-28 rounded-md border bg-white dark:bg-slate-950 px-2 py-1" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={rule.resolution_minutes}
                      onChange={(e) => updateRule(p, 'resolution_minutes', Number(e.target.value) || 0)}
                      className="w-28 rounded-md border bg-white dark:bg-slate-950 px-2 py-1" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
