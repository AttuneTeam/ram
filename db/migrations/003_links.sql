-- Web links attached to entries (a YouTube workout, an article), with a
-- preview fetched by the server. A workspace's links form its library.
-- Additive only: the currently deployed code keeps working against it.

create table links (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  -- Normalised (lib/links.ts normalizeUrl), so the same video pasted twice is one link.
  url           text not null check (url ~ '^https?://' and char_length(url) <= 2048),
  -- 'video' | 'page'. Only changes how the preview is drawn.
  kind          text not null default 'page' check (kind in ('video', 'page')),
  -- Preview metadata. All optional: a site that won't be previewed still saves.
  title         text check (title is null or char_length(title) <= 300),
  description   text check (description is null or char_length(description) <= 500),
  image_url     text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 2048)),
  site_name     text check (site_name is null or char_length(site_name) <= 100),
  created_at    timestamptz not null default now(),
  unique (workspace_id, url),
  -- Target for the composite FK on entries below.
  unique (id, workspace_id)
);

alter table entries add column link_id uuid;

-- The link must belong to the entry's workspace. Removing a link from the
-- library keeps the entries and clears only link_id.
alter table entries
  add constraint entries_link_fk
  foreign key (link_id, workspace_id)
  references links (id, workspace_id)
  on delete set null (link_id);

create index entries_link_idx on entries (link_id) where link_id is not null;
