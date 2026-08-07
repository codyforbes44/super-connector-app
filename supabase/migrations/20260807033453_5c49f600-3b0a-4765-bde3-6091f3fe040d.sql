ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS ai_prompt text,
  ADD COLUMN IF NOT EXISTS ai_first_message text,
  ADD COLUMN IF NOT EXISTS ai_tone text NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS ai_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS ai_fallback text NOT NULL DEFAULT 'voicemail',
  ADD COLUMN IF NOT EXISTS ai_fallback_number text,
  ADD COLUMN IF NOT EXISTS ai_max_duration integer NOT NULL DEFAULT 300;

ALTER TABLE public.phone_numbers DROP CONSTRAINT IF EXISTS phone_numbers_ai_fallback_check;
ALTER TABLE public.phone_numbers ADD CONSTRAINT phone_numbers_ai_fallback_check
  CHECK (ai_fallback IN ('voicemail','forward','hangup'));