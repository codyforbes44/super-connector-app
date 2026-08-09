DELETE FROM public.twiml_apps WHERE sid = 'APa9fdc26e6188ef8be2ae1dbdfffa060b';
INSERT INTO public.twiml_apps (sid, friendly_name, voice_url, sms_url, is_default)
VALUES ('AP9070e1f8eccd7ea9f9b8772330a506f3', 'sixvox',
 'https://project--5b038a02-865b-4cdd-8546-78cf96e0b0aa.lovable.app/api/public/twilio/app-voice',
 'https://project--5b038a02-865b-4cdd-8546-78cf96e0b0aa.lovable.app/api/public/twilio/sms', true)
ON CONFLICT (sid) DO UPDATE SET is_default = true, voice_url = EXCLUDED.voice_url, sms_url = EXCLUDED.sms_url;