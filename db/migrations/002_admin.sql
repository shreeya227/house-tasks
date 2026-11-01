-- Same as Flyway V2__admin.sql.
-- Who is allowed to change people and tasks. Everyone else can only tick Done.
alter table person add column if not exists is_admin boolean not null default false;
