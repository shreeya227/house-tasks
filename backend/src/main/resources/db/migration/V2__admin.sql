-- Who is allowed to change people and tasks. Everyone else can only tick Done.
alter table person add column is_admin boolean not null default false;
