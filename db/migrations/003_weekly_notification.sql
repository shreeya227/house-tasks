-- Exactly-once Monday messages. The job inserts a row before sending; the unique
-- constraint makes a second run in the same week skip that person.
-- Named differently from the Spring version's notification_log on purpose, so this
-- can never collide with a table that already exists in your Neon database.
create table if not exists weekly_notification (
  id            bigserial   primary key,
  household_id  bigint      not null references household(id) on delete cascade,
  week_index    int         not null,
  person_id     bigint      not null references person(id) on delete cascade,
  sent_at       timestamptz not null default now(),
  unique (household_id, week_index, person_id)
);
