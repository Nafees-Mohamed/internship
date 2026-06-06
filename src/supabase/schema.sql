-- Run this once in the Supabase SQL Editor to initialize all tables, indexes, RPCs, and seed data.

-- ── 1. QUESTIONS & VOTES (Live Q&A) ──────────────────────────────────────────
create table if not exists questions (
  id          uuid primary key default gen_random_uuid(),
  body        text not null,
  author      text,
  created_at  timestamptz default now()
);

create table if not exists votes (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions(id) on delete cascade,
  voter_id     text not null,
  created_at   timestamptz default now(),
  unique (question_id, voter_id)
);

create index if not exists votes_question_id_idx on votes (question_id);
create index if not exists questions_fts_idx on questions using gin (to_tsvector('english', body));

-- ── 2. VOTERS & SCORE SYSTEM (Leaderboard) ───────────────────────────────────
create table if not exists voters (
  voter_id    text primary key,
  username    text not null,
  points      integer not null default 0,
  created_at  timestamptz default now()
);

-- ── 3. POLLS & RESPONSES (Gaming & Polling) ──────────────────────────────────
create table if not exists polls (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  created_at  timestamptz default now()
);

create table if not exists poll_options (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references polls(id) on delete cascade,
  text        text not null,
  is_correct  boolean not null default false
);

create index if not exists poll_options_poll_id_idx on poll_options (poll_id);

create table if not exists poll_responses (
  id           uuid primary key default gen_random_uuid(),
  poll_id      uuid not null references polls(id) on delete cascade,
  option_id    uuid not null references poll_options(id) on delete cascade,
  voter_id     text not null,
  created_at   timestamptz default now(),
  unique (poll_id, voter_id)
);

create index if not exists poll_responses_poll_id_idx on poll_responses (poll_id);

-- ── 4. STORED PROCEDURES (RPCs) ──────────────────────────────────────────────

-- Atomically increments a voter's points, creating their profile if not exists
create or replace function increment_voter_points(v_id text, pts integer)
returns void as $$
begin
  insert into voters (voter_id, username, points)
  values (v_id, 'Anonymous Voter', pts)
  on conflict (voter_id)
  do update set points = voters.points + pts;
end;
$$ language plpgsql;

-- Creates or updates a voter's display name
create or replace function register_voter(v_id text, u_name text)
returns void as $$
begin
  insert into voters (voter_id, username, points)
  values (v_id, u_name, 0)
  on conflict (voter_id)
  do update set username = u_name;
end;
$$ language plpgsql;

-- ── 5. SEED DATA ─────────────────────────────────────────────────────────────

-- Seed Questions (if table is empty)
insert into questions (body, author, created_at)
select body, author, now() - (n || ' minutes')::interval
from (
  values
    (1,  'How do I deploy to Vercel?', 'Priya'),
    (2,  'What''s the difference between server and client components?', 'Marcus'),
    (3,  'When should I add a database index?', 'Aisha'),
    (4,  'How does Postgres full-text search work?', 'Diego'),
    (5,  'Why did my in-memory data vanish on restart?', 'Lena'),
    (6,  'Should I store a vote count or count vote rows?', 'Sam'),
    (7,  'What is a unique constraint good for?', 'Priya')
) as seed(n, body, author)
where not exists (select 1 from questions limit 1);

-- Seed Poll 1 (if polls table is empty)
do $$
declare
  poll1_id uuid;
begin
  if not exists (select 1 from polls limit 1) then
    insert into polls (question) 
    values ('Which Next.js routing model is used in our project?') 
    returning id into poll1_id;

    insert into poll_options (poll_id, text, is_correct)
    values 
      (poll1_id, 'Pages Router', false),
      (poll1_id, 'App Router', true),
      (poll1_id, 'Both Pages and App Router', false);
  end if;
end $$;

-- Seed Poll 2 (if polls table is empty)
do $$
declare
  poll2_id uuid;
begin
  if not exists (select 1 from polls where question like 'What is the time complexity%') then
    insert into polls (question) 
    values ('What is the average time complexity of looking up an item in a Hash Table?') 
    returning id into poll2_id;

    insert into poll_options (poll_id, text, is_correct)
    values 
      (poll2_id, 'O(1)', true),
      (poll2_id, 'O(log n)', false),
      (poll2_id, 'O(n)', false);
  end if;
end $$;
