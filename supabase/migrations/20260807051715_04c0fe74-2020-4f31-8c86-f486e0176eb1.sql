ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_number text;
ALTER TABLE public.phone_numbers ADD COLUMN IF NOT EXISTS outbound_caller_id text;