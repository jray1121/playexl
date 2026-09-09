-- Run this in your Supabase SQL editor to set up the database

-- Songs table
create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  composer text not null,
  arranger text,
  voicing text not null default 'SATB',
  is_acappella boolean not null default false,
  price integer not null default 499,  -- cents
  published boolean not null default false,
  tempo integer,
  parts jsonb not null default '[]',
  sheet_music_url text,
  click_track_url text,
  beat_map jsonb,          -- array of {timestamp, measure, beat, timeSig}
  time_sig_map jsonb not null default '[{"measure":1,"numerator":4,"denominator":4,"clickNoteValue":4}]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Purchases table (ready for Stripe integration)
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references songs(id) on delete cascade,
  stripe_payment_intent_id text,
  amount_paid integer,       -- cents
  created_at timestamptz not null default now(),
  unique(user_id, song_id)
);

-- RLS: songs are publicly readable if published
alter table songs enable row level security;

create policy "Published songs are public" on songs
  for select using (published = true);

create policy "Admin can do everything with songs" on songs
  for all using (auth.role() = 'authenticated');

-- RLS: purchases are private to each user
alter table purchases enable row level security;

create policy "Users can read own purchases" on purchases
  for select using (auth.uid() = user_id);

create policy "Admin can read all purchases" on purchases
  for select using (auth.role() = 'authenticated');

-- Student licenses (teacher-managed, no student PII)
create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,           -- e.g. "EXL-A3B4-C5D6"
  label text,                          -- optional teacher label e.g. "Period 2 – Seat 4"
  session_token text,                  -- set on first use; only one active session per code
  activated_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);

alter table licenses enable row level security;

-- Teachers can manage their own licenses
create policy "Teachers manage own licenses" on licenses
  for all using (auth.uid() = teacher_id);

-- API routes use the service role key to validate student tokens (bypasses RLS)

-- Storage buckets (create these in Supabase Dashboard > Storage)
-- Bucket: sheet-music    (public)
-- Bucket: audio-stems    (public)
-- Bucket: click-tracks   (public)
