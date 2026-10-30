-- "Pawprint": a typical vibe-coded pet-sitting booking app, as Bolt/Lovable would scaffold it.
-- All data is fake. RLS is OFF on every table (Bolt's default), and Supabase grants
-- anon/authenticated full table privileges by default, so the public key can read everything.

-- Supabase's auth model, reproduced: roles plus auth.uid() read from the request's JWT claims.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table profiles (
  id uuid primary key,
  email text not null,
  full_name text,
  phone text,
  home_address text,
  is_sitter boolean default false
);

create table bookings (
  id serial primary key,
  owner_id uuid references profiles(id),
  sitter_id uuid references profiles(id),
  pet_name text,
  start_date date,
  door_code text,
  price_cents int
);

create table messages (
  id serial primary key,
  booking_id int references bookings(id),
  sender_id uuid references profiles(id),
  body text
);

create table services (
  id serial primary key,
  title text,
  price_cents int
);

-- Supabase's default grants on tables created in the public schema.
grant all on all tables in schema public to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
