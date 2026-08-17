-- Student memory & profile schema for AITuberKit (Cô Mây)
-- Run once in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.students (
  id uuid primary key,
  display_name text,
  preferred_name text,
  address_form text,
  grade_level text,
  current_topic text,
  progress_notes text,
  interests text[],
  strengths text,
  weaknesses text,
  memory_summary text,
  last_active timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  role text not null,
  content text,
  emotion text,
  client_message_id text,
  created_at timestamptz not null default now()
);
create index if not exists messages_student_created_idx
  on public.messages (student_id, created_at);

-- Upgrade path for installs that already ran this script before
-- client_message_id existed.
alter table public.messages add column if not exists client_message_id text;
create unique index if not exists messages_student_client_msg_idx
  on public.messages (student_id, client_message_id);

create table if not exists public.memory_facts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  category text not null,
  key text not null,
  value text not null,
  confidence real not null default 0.7,
  source_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, category, key)
);
create index if not exists memory_facts_student_idx
  on public.memory_facts (student_id);

-- Light RLS: device-based identity, no auth. Anon may read/write.
-- (Accepted trade-off for demo/internal use; student_id is a random uuid.)
alter table public.students enable row level security;
alter table public.messages enable row level security;
alter table public.memory_facts enable row level security;

create policy "anon full access students" on public.students
  for all to anon using (true) with check (true);
create policy "anon full access messages" on public.messages
  for all to anon using (true) with check (true);
create policy "anon full access memory_facts" on public.memory_facts
  for all to anon using (true) with check (true);
