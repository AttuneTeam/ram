-- Workspaces are the only tenant boundary. There are no user accounts: a
-- workspace is reached by its unguessable slug, optionally gated by a PIN.
--
-- The browser never talks to these tables. Every read and write goes through
-- the Next.js server using the service-role key, after the server has checked
-- the slug (and PIN cookie, when set). RLS is enabled with NO policies, so the
-- anon/authenticated roles are denied everything — if the anon key ever leaks
-- into a client bundle, it can read nothing.

create table workspaces (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[A-Za-z0-9]{10,32}$'),
  name                text not null check (char_length(name) between 1 and 80),
  -- scrypt hash "salt:hash" (hex). Null = no PIN.
  pin_hash            text,
  -- Brute-force protection for 4-digit PINs.
  failed_pin_attempts int not null default 0,
  pin_locked_until    timestamptz,
  -- { divider: 'none' | 'month' | 'year', weekStart: 0 | 1 }
  settings            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create table categories (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  color         text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- Optional unit for quantities, e.g. "min", "pages", "km".
  unit          text check (unit is null or char_length(unit) between 1 and 16),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (workspace_id, name),
  -- Target for the composite FK on entries below.
  unique (id, workspace_id)
);

create table entries (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  category_id   uuid not null,
  day           date not null,
  description   text not null default '' check (char_length(description) <= 280),
  quantity      numeric check (quantity is null or quantity >= 0),
  created_at    timestamptz not null default now(),
  -- An entry's category must belong to the same workspace.
  foreign key (category_id, workspace_id)
    references categories (id, workspace_id) on delete cascade
);

create index categories_workspace_idx on categories (workspace_id, sort_order);
create index entries_workspace_day_idx on entries (workspace_id, day);
create index entries_category_idx on entries (category_id);

alter table workspaces enable row level security;
alter table categories enable row level security;
alter table entries    enable row level security;

revoke all on workspaces, categories, entries from anon, authenticated;
