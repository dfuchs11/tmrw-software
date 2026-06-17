-- Create the access_requests table
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

create table if not exists access_requests (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  business_name text not null,
  business_type text not null,
  num_employees text not null,
  num_locations text not null,
  email text not null,
  phone text,
  created_at timestamptz default now() not null
);

-- Enable RLS (no public access — only service role key can insert)
alter table access_requests enable row level security;
