-- People who log into a shared workspace, and a read-only share link.
-- Additive only: the currently deployed code keeps working against it.

create table people (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  -- Target for the composite FK on entries below.
  unique (id, workspace_id)
);

-- "Raul Carrizo" and "raul carrizo" are the same person, and would show the
-- same avatar, so names are unique per workspace ignoring case.
create unique index people_workspace_name_idx on people (workspace_id, lower(name));
create index people_workspace_idx on people (workspace_id, sort_order);

-- Who logged an entry. Null = not attributed (entries from before people
-- existed, or a workspace that doesn't use them).
alter table entries add column person_id uuid;

-- The person must belong to the entry's workspace. Removing a person keeps
-- their entries and just clears the attribution — only person_id is nulled,
-- never workspace_id.
alter table entries
  add constraint entries_person_fk
  foreign key (person_id, workspace_id)
  references people (id, workspace_id)
  on delete set null (person_id);

create index entries_person_idx on entries (person_id) where person_id is not null;

-- Secret for the read-only link /v/<view_token>. Null = view link turned off.
-- Distinct from the edit slug, so sharing it never grants editing.
alter table workspaces
  add column view_token text unique check (view_token ~ '^[A-Za-z0-9]{16,40}$');
