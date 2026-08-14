ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS messaging_service_sid text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS campaign_status text,
  ADD COLUMN IF NOT EXISTS messaging_checked_at timestamp with time zone;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS opted_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opted_out_at timestamp with time zone;