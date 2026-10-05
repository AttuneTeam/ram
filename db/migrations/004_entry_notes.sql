-- Free-form context notes on an entry. Additive: the deployed code ignores it.
alter table entries
  add column if not exists notes text not null default '' check (char_length(notes) <= 2000);
