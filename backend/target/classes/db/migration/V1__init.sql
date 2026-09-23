create table household (
  id              bigserial primary key,
  name            text        not null,
  join_code       text        not null unique,
  timezone        text        not null default 'America/New_York',
  week_start_date date        not null,
  created_at      timestamptz not null default now()
);

create table task (
  id             bigserial primary key,
  household_id   bigint  not null references household(id) on delete cascade,
  name           text    not null,
  covers         text    not null default '',
  load_level     text    not null default 'Medium',
  sequence_order int     not null
);

create table person (
  id             bigserial primary key,
  household_id   bigint  not null references household(id) on delete cascade,
  name           text    not null,
  position       int     not null,
  owned_task_id  bigint  references task(id) on delete set null,
  notify_weekly  boolean not null default true
);

create table push_subscription (
  id          bigserial primary key,
  person_id   bigint      not null references person(id) on delete cascade,
  endpoint    text        not null unique,
  p256dh_key  text        not null,
  auth_key    text        not null,
  created_at  timestamptz not null default now()
);

create table swap (
  id            bigserial primary key,
  household_id  bigint not null references household(id) on delete cascade,
  week_index    int    not null,
  person_a_id   bigint not null references person(id) on delete cascade,
  person_b_id   bigint not null references person(id) on delete cascade
);

create table completion (
  id            bigserial primary key,
  household_id  bigint      not null references household(id) on delete cascade,
  week_index    int         not null,
  task_id       bigint      not null references task(id) on delete cascade,
  person_id     bigint      references person(id) on delete set null,
  completed_at  timestamptz not null default now(),
  unique (household_id, week_index, task_id)
);

create index idx_person_household on person(household_id, position);
create index idx_task_household on task(household_id, sequence_order);
create index idx_swap_week on swap(household_id, week_index);
create index idx_completion_week on completion(household_id, week_index);
