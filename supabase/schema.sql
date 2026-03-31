create extension if not exists "pgcrypto";

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  age integer,
  source text not null default 'Instagram',
  instagram_handle text,
  avatar_url text,
  tags text[] not null default '{}',
  status text not null default 'active',
  attraction_level text not null default 'Medium',
  personality_type text,
  interests text[] not null default '{}',
  last_interaction_summary text,
  green_flags text[] not null default '{}',
  red_flags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  sender text not null check (sender in ('user', 'contact')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.analyses (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  insights text,
  strategy text,
  flags jsonb not null default '[]'::jsonb,
  instagram jsonb not null default '{}'::jsonb,
  last_advice jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
