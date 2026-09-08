-- =====================================================================
-- Google Contacts <-> Atomic CRM bi-directional sync : DB preparation
-- Run this ONCE against your Atomic CRM Supabase/Postgres database.
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE).
-- =====================================================================
 
-- ---------------------------------------------------------------------
-- 1. CHANGE DETECTION ON CONTACTS
-- Atomic CRM's contacts table has no updated_at column. We need one so the
-- sync can tell which CRM contacts changed since the last poll.
-- ---------------------------------------------------------------------
alter table public.contacts
  add column if not exists updated_at timestamptz not null default now();
 
create or replace function public.set_contacts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
 
drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row
  execute function public.set_contacts_updated_at();
 
-- Backfill existing rows so they don't all look "changed" on first run.
update public.contacts set updated_at = coalesce(last_seen, now())
where updated_at is null;
 
-- ---------------------------------------------------------------------
-- 2. ADDRESS FIELDS ON CONTACTS
-- You chose to sync postal address. The stock contacts table has no address
-- columns (only the companies table does). Add minimal address columns.
-- If you prefer not to alter contacts, skip this and map address -> background
-- in the workflow instead (see the guide).
-- ---------------------------------------------------------------------
alter table public.contacts add column if not exists address    text;
alter table public.contacts add column if not exists zipcode    text;
alter table public.contacts add column if not exists city       text;
alter table public.contacts add column if not exists state_abbr text;
alter table public.contacts add column if not exists country    text;
 
-- ---------------------------------------------------------------------
-- 3. SYNC STATE (single row): holds Google sync token + last CRM poll time
-- ---------------------------------------------------------------------
create table if not exists public.gsync_state (
  id                 boolean primary key default true,           -- enforces a single row
  google_sync_token  text,                                       -- People API nextSyncToken
  last_crm_sync      timestamptz not null default '1970-01-01',  -- high-water mark for CRM changes
  updated_at         timestamptz not null default now(),
  constraint gsync_state_singleton check (id)
);
 
insert into public.gsync_state (id) values (true)
on conflict (id) do nothing;
 
-- ---------------------------------------------------------------------
-- 4. MAPPING TABLE: links a CRM contact <-> a Google contact, and stores
-- the last-synced version markers used for loop / echo suppression.
-- ---------------------------------------------------------------------
create table if not exists public.gsync_contact_map (
  crm_contact_id            bigint primary key
                              references public.contacts(id) on delete cascade,
  google_resource_name      text unique,                 -- e.g. people/c12345
  google_etag               text,                        -- last etag we wrote/read
  last_synced_crm_updated_at timestamptz,                -- contacts.updated_at at last sync
  content_hash              text,                        -- normalized hash of synced fields
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
 
create index if not exists idx_gsync_map_resource
  on public.gsync_contact_map (google_resource_name);
 
-- ---------------------------------------------------------------------
-- 5. (Optional) A dedicated low-privilege role for n8n is recommended over
-- using the service_role key. Uncomment and set a strong password.
-- This grants only what the sync needs.
-- ---------------------------------------------------------------------
-- create role n8n_sync login password 'CHANGE_ME_STRONG';
-- grant usage on schema public to n8n_sync;
-- grant select, insert, update, delete on
--   public.contacts, public.companies, public.tags,
--   public.gsync_state, public.gsync_contact_map to n8n_sync;
-- grant usage, select on all sequences in schema public to n8n_sync;
-- -- contacts.id etc. are identity columns; ensure inserts can get ids:
-- grant select on public.sales to n8n_sync;  -- to look up sales_id
 
-- Done. Verify your contact email/phone storage format before wiring the
-- workflow:  select email_jsonb, phone_jsonb from public.contacts limit 1;
-- If those columns don't exist and you instead have email / phone_1_number,
-- you're on the legacy flat schema -- see the guide's mapping notes.
 
