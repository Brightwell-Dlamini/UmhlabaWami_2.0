// src/components/audit/EntityAuditTrail.tsx
import React from 'react';
import { History, Loader2 } from 'lucide-react';
import { auditLogs as auditApi } from '../../services/api/auditLogs';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';

interface Props {
  entityId: string;
  entityType: string;
  /** Show at most N entries. Default 20. */
  limit?: number;
}

export function EntityAuditTrail({ entityId, entityType, limit = 20 }: Props) {
  const { data: logs = [], loading } = useSupabaseQuery(
    ['audit_logs', entityType, entityId],
    () => auditApi.list().then((all) => all.filter(
      (l) => l.entity_id === entityId && l.entity_type === entityType
    )),
    { enabled: !!entityId }
  );

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading history…
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-xs text-slate-400 py-4 flex items-center gap-2">
        <History className="w-3.5 h-3.5" />
        No history recorded for this {entityType}.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
        <History className="w-3.5 h-3.5" /> Change history
      </h4>
      <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
        {logs.slice(0, limit).map((l) => (
          <div key={l.id} className="relative">
            <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-slate-400 ring-4 ring-white dark:ring-slate-900" />
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              {l.action}
            </div>
            {l.details && (
              <div className="text-[11px] text-slate-500 mt-0.5">
                {l.details}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-0.5">
              {l.user_name} · {new Date(l.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
