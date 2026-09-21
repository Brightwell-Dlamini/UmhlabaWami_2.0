# SLA Escalation

## Overview

Tickets have an `sla_status` column with four values:
- `Compliant` — resolution deadline is in the future, response recorded
- `Warning` — within 25% of the deadline
- `Overdue` — deadline passed, ticket unresolved
- `Escalated` — overdue and the escalation pass has flagged it

The `sla_status` column is advanced by the SQL function
`run_sla_escalation_pass(p_org_id uuid)`.

## Client-side loop (UX only)

`OperationsApp` calls `ticketsApi.runEscalation()` on mount and every 60s
when the tab is visible. This is **not** a substitute for the cron job:

- It only runs while a user has the tab open.
- It runs with the user's session, so RLS applies.
- It stops entirely when all users log out.

Its only purpose is to keep the on-screen SLA badges fresh.

## Server-side cron (authoritative)

The function must run on a schedule regardless of client activity.
See `supabase/migrations/010_sla_escalation_cron.sql` for the migration.

Recommended schedule: every 5 minutes.

## Function contract

