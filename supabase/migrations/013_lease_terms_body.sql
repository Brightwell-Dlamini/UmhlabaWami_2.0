-- Full lease wording tenants read before signing
alter table leases
  add column if not exists terms_body text;

comment on column leases.terms_body is
  'Plain-text (or markdown) lease terms shown to tenants before digital signature.';
