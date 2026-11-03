/** Additive only. Existing entities, imported study facts and history are untouched. */
export const sql = `
CREATE TABLE event_series (
 id TEXT PRIMARY KEY REFERENCES calendar_events(id) ON DELETE CASCADE,
 frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','monthly')),
 interval INTEGER NOT NULL CHECK(interval BETWEEN 1 AND 365),
 until_date TEXT
);
CREATE TABLE event_occurrences (
 event_id TEXT PRIMARY KEY REFERENCES calendar_events(id) ON DELETE CASCADE,
 series_id TEXT NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
 original_date TEXT NOT NULL,
 UNIQUE(series_id,original_date)
);
CREATE TABLE note_folders(id TEXT PRIMARY KEY,name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100));
CREATE TABLE note_folder_membership(note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,folder_id TEXT NOT NULL REFERENCES note_folders(id) ON DELETE CASCADE);
CREATE TABLE entity_links(source_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,target_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,relation TEXT NOT NULL CHECK(relation IN ('related','backlink')),PRIMARY KEY(source_id,target_id,relation),CHECK(source_id<>target_id));
CREATE TABLE session_kinds(session_id TEXT PRIMARY KEY REFERENCES focus_sessions(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('work','break')));
CREATE TABLE notification_receipts(key TEXT PRIMARY KEY,delivered_at TEXT NOT NULL);
CREATE INDEX entity_changes_entity_time ON entity_changes(entity_id,at);
CREATE INDEX entities_due_active ON entities(due,status) WHERE deleted_at IS NULL;
`;
