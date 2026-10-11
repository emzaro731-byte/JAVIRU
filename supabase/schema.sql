-- JAVIRU orders storage for Supabase Auth.
-- Run this file once in Supabase Dashboard -> SQL Editor -> New query.
-- This uses only the Supabase project URL and publishable key in the application.
create extension if not exists pgcrypto;

create table if not exists public.javiru_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference text not null unique,
  full_name text not null,
  phone text not null,
  email text not null,
  address text not null,
  state text not null,
  payment_method text not null default 'Pay on delivery',
  status text not null default 'Pending',
  total numeric(12,2) not null check (total >= 0),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists javiru_orders_user_created_idx
  on public.javiru_orders (user_id, created_at desc);

alter table public.javiru_orders enable row level security;

drop policy if exists "Customers can read their own JAVIRU orders" on public.javiru_orders;
create policy "Customers can read their own JAVIRU orders"
  on public.javiru_orders
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Customers can create their own JAVIRU orders" on public.javiru_orders;
create policy "Customers can create their own JAVIRU orders"
  on public.javiru_orders
  for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke all on public.javiru_orders from anon;
grant select, insert on public.javiru_orders to authenticated;
