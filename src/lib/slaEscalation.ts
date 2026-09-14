import { tickets as ticketsApi } from '../services/api/tickets';

/**
 * Runs the SLA escalation pass for the current org.
 * Also invocable server-side via Supabase cron (`select run_sla_escalation_pass();`).
 */
export async function runSlaEscalationPass(organizationId?: string): Promise<number> {
  try {
    return await ticketsApi.runEscalation(organizationId);
  } catch (e) {
    console.warn('[slaEscalation] failed', e);
    return 0;
  }
}
