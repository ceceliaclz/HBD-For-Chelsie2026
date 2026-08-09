create table if not exists couple_books (
  id uuid primary key,
  invite_code text unique not null check (char_length(invite_code) = 6),
  marker_pack text not null default 'stars',
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key,
  book_id uuid not null references couple_books(id) on delete cascade,
  role text not null check (role in ('rabbit', 'dog')),
  device_token text not null,
  joined_at timestamptz not null default now(),
  unique (book_id, role),
  unique (book_id, device_token)
);

create table if not exists places (
  id uuid primary key,
  book_id uuid not null references couple_books(id) on delete cascade,
  place_type text not null check (place_type in ('country', 'city')),
  name text not null,
  country_code text not null,
  lat double precision not null,
  lng double precision not null,
  visitor text not null check (visitor in ('rabbit', 'dog', 'together')),
  visited_on date null,
  updated_at timestamptz not null,
  unique (book_id, place_type, country_code, name)
);

alter table couple_books enable row level security;
alter table members enable row level security;
alter table places enable row level security;

-- v1: the invite code is the access gate, so the anon key has full access.
create policy "anon_all_books"
  on couple_books for all
  using (true)
  with check (true);

create policy "anon_all_members"
  on members for all
  using (true)
  with check (true);

create policy "anon_all_places"
  on places for all
  using (true)
  with check (true);
