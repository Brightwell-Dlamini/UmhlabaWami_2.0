import { sb, unwrap, requireOrgId, throwFriendly } from './_helpers';
import type { BankTransaction, PaymentRecord } from '../../types';

export interface BankTxInput {
  date: string;
  description: string;
  amount: number;
  direction: BankTransaction['direction'];
}

export const bankTransactions = {
  async list(orgId = requireOrgId()): Promise<BankTransaction[]> {
    const result = await sb()
      .from('bank_transactions')
      .select('*')
      .eq('organization_id', orgId)
      .order('date', { ascending: false });
    return unwrap(result) as unknown as BankTransaction[];
  },

  async create(input: BankTxInput): Promise<BankTransaction> {
    const result = await sb()
      .from('bank_transactions')
      .insert({ organization_id: requireOrgId(), reconciled: false, ...input })
      .select()
      .single();
    return unwrap(result) as unknown as BankTransaction;
  },

  /**
   * Import a simple bank CSV.
   * Expected headers (flexible): date, description, amount
   * OR date, description, debit, credit
   * Amount positive = credit (money in) when single amount column.
   */
  async importCsv(csvText: string): Promise<number> {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new Error('CSV needs a header row and at least one data row.');
    }

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const dateIdx = header.findIndex((h) => h.includes('date'));
    const descIdx = header.findIndex(
      (h) => h.includes('desc') || h.includes('narration') || h.includes('particular')
    );
    const amountIdx = header.findIndex((h) => h === 'amount' || h.includes('amount'));
    const debitIdx = header.findIndex((h) => h.includes('debit') || h === 'dr');
    const creditIdx = header.findIndex((h) => h.includes('credit') || h === 'cr');

    if (dateIdx < 0) {
      throw new Error('CSV must include a date column.');
    }

    const orgId = requireOrgId();
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const dateRaw = cols[dateIdx]?.trim();
      if (!dateRaw) continue;
      const date = normalizeDate(dateRaw);
      if (!date) continue;

      const description = (descIdx >= 0 ? cols[descIdx] : cols[1] || 'Bank line').trim() || 'Bank line';

      let amount = 0;
      let direction: BankTransaction['direction'] = 'credit';

      if (debitIdx >= 0 || creditIdx >= 0) {
        const debit = Math.abs(parseNum(cols[debitIdx] ?? '0'));
        const credit = Math.abs(parseNum(cols[creditIdx] ?? '0'));
        if (credit > 0) {
          amount = credit;
          direction = 'credit';
        } else if (debit > 0) {
          amount = debit;
          direction = 'debit';
        } else {
          continue;
        }
      } else if (amountIdx >= 0) {
        const n = parseNum(cols[amountIdx] ?? '0');
        if (!n) continue;
        amount = Math.abs(n);
        direction = n >= 0 ? 'credit' : 'debit';
      } else {
        continue;
      }

      const { error } = await sb().from('bank_transactions').insert({
        organization_id: orgId,
        date,
        description,
        amount,
        direction,
        reconciled: false,
      });
      if (!error) imported += 1;
    }

    return imported;
  },

  /**
   * Suggest unreconciled payment_records that match amount (±0.01) and optional reference in description.
   */
  async suggestMatches(bankTxId: string): Promise<PaymentRecord[]> {
    const { data: tx, error } = await sb()
      .from('bank_transactions')
      .select('*')
      .eq('id', bankTxId)
      .single();
    if (error) throwFriendly(error);
    if (tx.direction !== 'credit') return [];

    const orgId = requireOrgId();
    const { data: pays, error: pErr } = await sb()
      .from('payment_records')
      .select('*')
      .eq('organization_id', orgId)
      .gte('amount', Number(tx.amount) - 0.01)
      .lte('amount', Number(tx.amount) + 0.01)
      .order('paid_at', { ascending: false })
      .limit(20);
    if (pErr) throwFriendly(pErr);

    const desc = String(tx.description || '').toLowerCase();
    const list = (pays ?? []) as PaymentRecord[];
    return list.sort((a, b) => {
      const aHit = a.reference && desc.includes(String(a.reference).toLowerCase()) ? 1 : 0;
      const bHit = b.reference && desc.includes(String(b.reference).toLowerCase()) ? 1 : 0;
      return bHit - aHit;
    });
  },

  async reconcile(id: string, paymentId?: string): Promise<BankTransaction> {
    const { data, error } = await sb().rpc('reconcile_bank_transaction', {
      p_bank_tx_id: id,
      p_payment_id: paymentId ?? null,
    });
    if (error) throwFriendly(error);
    return data as unknown as BankTransaction;
  },

  async unreconcile(id: string): Promise<BankTransaction> {
    const result = await sb()
      .from('bank_transactions')
      .update({ reconciled: false, matched_payment_id: null })
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as BankTransaction;
  },
};

function parseNum(s: string): number {
  const cleaned = s.replace(/["'\s,]/g, '').replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(raw: string): string | null {
  const s = raw.replace(/"/g, '').trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}
