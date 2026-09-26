-- Phase 4 receptionist: booking proposals, spam lists, lead fields, Spanish stays on ai_language.
-- Additive columns only. Existing rows keep current booking behaviour (confirm mode, no travel, no service area).
--
-- Rollback:
--   drop table if exists public.caller_line_cache;
--   drop table if exists public.caller_lists;
--   drop table if exists public.booking_proposals;
--   alter table public.phone_numbers
--     drop column if exists booking_travel_minutes,
--     drop column if exists booking_confirm_mode,
--     drop column if exists service_area_mode,
--     drop column if exists service_area_radius_miles,
--     drop column if exists service_area_lat,
--     drop column if exists service_area_lng,
--     drop column if exists service_area_address,
--     drop column if exists service_area_zips;
--   -- workspace_id on phone_numbers is shared with missed-call text-back.
--   -- Drop it only when both features are rolled back.
--   alter table public.call_intelligence
--     drop column if exists lead_name,
--     drop column if exists lead_callback,
--     drop column if exists lead_address,
--     drop column if exists lead_address_valid,
--     drop column if exists lead_job_type,
--     drop column if exists lead_urgency,
--     drop column if exists tags,
--     drop column if exists assigned_to,
--     drop column if exists workspace_id;
--   alter table public.call_transcripts drop column if exists workspace_id;
--   alter table public.calendar_bookings
--     drop column if exists workspace_id,
--     drop column if exists proposal_id,
--     drop column if exists status;
--   alter table public.calls
--     drop column if exists spam_score,
--     drop column if exists spam_action,
--     drop column if exists spam_reason,
--     drop column if exists stir_verstat,
--     drop column if exists line_type;
--   -- workspace_id on calls is shared with missed-call text-back.
--   -- Drop it only when both features are rolled back.

alter table public.phone_numbers
  add column if not exists booking_travel_minutes integer not null default 0,
  add column if not exists booking_confirm_mode text not null default 'confirm',
  add column if not exists service_area_mode text not null default 'off',
  add column if not exists service_area_radius_miles numeric,
  add column if not exists service_area_lat double precision,
  add column if not exists service_area_lng double precision,
  add column if not exists service_area_address text,
  add column if not exists service_area_zips text[] not null default '{}',
  add column if not exists workspace_id uuid;

alter table public.call_intelligence
  add column if not exists lead_name text,
  add column if not exists lead_callback text,
  add column if not exists lead_address text,
  add column if not exists lead_address_valid boolean,
  add column if not exists lead_job_type text,
  add column if not exists lead_urgency text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists assigned_to uuid,
  add column if not exists workspace_id uuid;

alter table public.call_transcripts
  add column if not exists workspace_id uuid;

alter table public.calendar_bookings
  add column if not exists workspace_id uuid,
  add column if not exists proposal_id uuid,
  add column if not exists status text not null default 'confirmed';

alter table public.calls
  add column if not exists spam_score integer,
  add column if not exists spam_action text,
  add column if not exists spam_reason text,
  add column if not exists stir_verstat text,
  add column if not exists line_type text,
  add column if not exists workspace_id uuid;

create table if not exists public.booking_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  app_number text not null,
  call_sid text,
  contact_number text,
  contact_name text,
  address text,
  address_lat double precision,
  address_lng double precision,
  place_id text,
  postal_code text,
  in_service_area boolean,
  job_type text,
  summary text,
  language text not null default 'en',
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status text not null default 'proposed',
  confirm_mode text not null default 'confirm',
  customer_reply text,
  sms_status text,
  calendar_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, update on public.booking_proposals to authenticated;
grant all on public.booking_proposals to service_role;
alter table public.booking_proposals enable row level security;

drop policy if exists "Owners see booking proposals" on public.booking_proposals;
create policy "Owners see booking proposals" on public.booking_proposals
  for select to authenticated
  using (public.can_see_number(auth.uid(), app_number));

drop policy if exists "Owners update booking proposals" on public.booking_proposals;
create policy "Owners update booking proposals" on public.booking_proposals
  for update to authenticated
  using (public.can_see_number(auth.uid(), app_number))
  with check (public.can_see_number(auth.uid(), app_number));

drop trigger if exists update_booking_proposals_updated_at on public.booking_proposals;
create trigger update_booking_proposals_updated_at before update on public.booking_proposals
  for each row execute function public.set_updated_at();

create index if not exists booking_proposals_number_idx
  on public.booking_proposals (app_number, status, created_at desc);

create table if not exists public.caller_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null,
  list text not null check (list in ('allow', 'block')),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, phone_number)
);

grant select, insert, update, delete on public.caller_lists to authenticated;
grant all on public.caller_lists to service_role;
alter table public.caller_lists enable row level security;

drop policy if exists "Owners manage caller lists" on public.caller_lists;
create policy "Owners manage caller lists" on public.caller_lists
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

create table if not exists public.caller_line_cache (
  phone_number text primary key,
  line_type text,
  looked_up_at timestamptz not null default now()
);

grant all on public.caller_line_cache to service_role;
alter table public.caller_line_cache enable row level security;