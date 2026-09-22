-- Banking details printed on invoices and statements
alter table organizations
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_branch_code text,
  add column if not exists bank_swift text;

comment on column organizations.bank_name is 'Bank name shown on invoices';
