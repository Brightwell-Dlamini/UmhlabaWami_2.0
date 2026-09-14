-- Phase 4 — Commercial engine (invoices, payments, bank lines)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Rent',
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  tenant_name TEXT,
  shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  shop_number TEXT,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  currency TEXT NOT NULL DEFAULT 'SZL',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'EFT',
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  reconciled BOOLEAN NOT NULL DEFAULT false,
  matched_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_org ON invoices FOR ALL
  USING (organization_id = public.current_org_id() OR public.is_super_admin())
  WITH CHECK (organization_id = public.current_org_id() OR public.is_super_admin());

CREATE POLICY payments_org ON payments FOR ALL
  USING (organization_id = public.current_org_id() OR public.is_super_admin())
  WITH CHECK (organization_id = public.current_org_id() OR public.is_super_admin());

CREATE POLICY bank_tx_org ON bank_transactions FOR ALL
  USING (organization_id = public.current_org_id() OR public.is_super_admin())
  WITH CHECK (organization_id = public.current_org_id() OR public.is_super_admin());
