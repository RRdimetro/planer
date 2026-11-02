import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
});
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
});
export const migrations = sqliteTable("schema_migrations", {
  version: integer("version").primaryKey(),
  appliedAt: text("applied_at").notNull(),
});
