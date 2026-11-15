import { pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const jobs = pgTable('jobs', {
  id: uuid().primaryKey(),
  owner: uuid().notNull(),
  url: text().notNull(),
  instruction: text().notNull(),
  runtime: text().notNull(),
  status: text().notNull(),
  message: text().notNull(),
  plan: text(),
  result: text(),
  dispatchHash: text('dispatch_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex('one_active_job
