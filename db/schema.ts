import {
  sqliteTable,
  text,
  real,
  integer,
  index,
} from 'drizzle-orm/sqlite-core';
export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    title: text('title').notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    city: text('city').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    observedAt: text('observed_at').notNull(),
    status: text('status').notNull().default('접수'),
    evidence: text('evidence').notNull().default(''),
    radius: integer('radius').notNull(),
    cctv: integer('cctv'),
    lights: integer('lights'),
    sourceAt: text('source_at').notNull(),
    created: text('created').notNull(),
    updated: text('updated').notNull(),
  },
  (t) => [index('reports_owner_created').on(t.owner, t.created)],
);
export const patrols = sqliteTable(
  'patrols',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    city: text('city').notNull(),
    memo: text('memo').notNull(),
    checks: text('checks').notNull(),
    started: text('started').notNull(),
    ended: text('ended').notNull(),
    seconds: integer('seconds').notNull(),
  },
  (t) => [index('patrols_owner_ended').on(t.owner, t.ended)],
);
