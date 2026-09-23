-- 017_payment_claims_and_pop_storage.sql
-- Run this in the Supabase SQL editor (or via supabase db push).
-- Enables: tenant POP claims, invoice cancel, POP file uploads.

-- ---------------------------------------------------------------------------
-- 1) Tenant-safe payment claim: appends only POP_CLAIM lines to notes
--    (tenants cannot change status, totals, or other fields)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_invoice_payment_claim(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL,
  p_proof_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_org uuid;
  v_inv invoices%ROWTYPE;
  v_tenant_user uuid;
  v_claim text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, organization_id INTO v_role, v_org
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_inv.organization_id IS DISTINCT FROM v_org AND v_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Invoice is outside your organisation';
  END IF;

  IF v_inv.status IN ('Paid', 'Cancelled') THEN
    RAISE EXCEPTION 'Invoice is already settled';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- Tenants may only claim on their own invoice
  IF v_role = 'tenant' THEN
    SELECT user_id INTO v_tenant_user
    FROM tenants
    WHERE id = v_inv.tenant_id;

    IF v_tenant_user IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'You can only submit payment claims on your own invoices';
    END IF;
  ELSIF v_role NOT IN ('admin', 'finance', 'property_manager', 'super_admin') THEN
    RAISE EXCEPTION 'Not allowed to submit payment claims';
  END IF;

  v_claim := 'POP_CLAIM:' || json_build_object(
    'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'by', (SELECT name FROM profiles WHERE id = v_uid),
    'amount', p_amount,
    'method', COALESCE(p_method, 'EFT'),
    'reference', COALESCE(p_reference, ''),
    'proof_url', COALESCE(p_proof_url, ''),
    'notes', COALESCE(p_notes, '')
  )::text;

  UPDATE invoices
  SET notes = CASE
    WHEN notes IS NULL OR btrim(notes) = '' THEN v_claim
    ELSE notes || E'\n' || v_claim
  END
  WHERE id = p_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_invoice_payment_claim(uuid, numeric, text, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Staff cancel invoice (status only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_invoice(
  p_invoice_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_org uuid;
  v_inv invoices%ROWTYPE;
  v_note text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, organization_id INTO v_role, v_org FROM profiles WHERE id = v_uid;

  IF v_role NOT IN ('admin', 'finance', 'property_manager', 'super_admin') THEN
    RAISE EXCEPTION 'Only finance or admin can cancel invoices';
  END IF;

  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_inv.organization_id IS DISTINCT FROM v_org AND v_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Invoice is outside your organisation';
  END IF;

  IF v_inv.status = 'Cancelled' THEN
    RAISE EXCEPTION 'Invoice is already cancelled';
  END IF;

  IF v_inv.status = 'Paid' THEN
    RAISE EXCEPTION 'Paid invoices cannot be cancelled. Issue a credit note instead.';
  END IF;

  v_note := COALESCE(
    'Cancelled: ' || NULLIF(btrim(p_reason), ''),
    'Cancelled on ' || to_char(now()::date, 'YYYY-MM-DD')
  );

  UPDATE invoices
  SET
    status = 'Cancelled',
    notes = CASE
      WHEN notes IS NULL OR btrim(notes) = '' THEN v_note
      ELSE notes || E'\n' || v_note
    END
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  RETURN v_inv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_invoice(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Storage: ensure ticket-attachments can hold POP files for org members
--    (bucket must already exist in Storage dashboard — create if missing)
-- ---------------------------------------------------------------------------
-- Create bucket if your project does not have it yet (safe no-op pattern):
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users in an org may upload under {org_id}/...
DROP POLICY IF EXISTS "pop_upload_org_path" ON storage.objects;
CREATE POLICY "pop_upload_org_path"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "pop_read_org_path" ON storage.objects;
CREATE POLICY "pop_read_org_path"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    (storage.foldername(name))[1] = (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  )
);
