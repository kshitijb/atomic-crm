-- Ensure columns exist and default to an empty array []
ALTER TABLE public.contacts 
  ALTER COLUMN email_jsonb SET DEFAULT '[]'::jsonb,
  ALTER COLUMN phone_jsonb SET DEFAULT '[]'::jsonb,
  ALTER COLUMN address_jsonb SET DEFAULT '[]'::jsonb;

-- Update any existing NULL values to empty arrays to prevent frontend crashes
UPDATE public.contacts SET email_jsonb = '[]'::jsonb WHERE email_jsonb IS NULL;
UPDATE public.contacts SET phone_jsonb = '[]'::jsonb WHERE phone_jsonb IS NULL;
UPDATE public.contacts SET address_jsonb = '[]'::jsonb WHERE address_jsonb IS NULL;