-- Add unique identifier for Google Sync
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- Add missing fields for Google Sync
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address_jsonb JSONB;