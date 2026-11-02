export const sql = `
CREATE TABLE attachment_blobs(sha256 TEXT PRIMARY KEY CHECK(length(sha256)=64),content BLOB NOT NULL);
CREATE TABLE attachment_digests(id TEXT PRIMARY KEY REFERENCES attachments(id) ON DELETE CASCADE,sha256 TEXT NOT NULL REFERENCES attachment_blobs(sha256));
CREATE TRIGGER dependency_acyclic BEFORE INSERT ON task_dependencies BEGIN
 SELECT RAISE(ABORT,'Циклическая зависимость') WHERE EXISTS(WITH RECURSIVE chain(id) AS(SELECT NEW.depends_on_id UNION SELECT d.depends_on_id FROM task_dependencies d JOIN chain c ON d.task_id=c.id) SELECT 1 FROM chain WHERE id=NEW.task_id);
END;
CREATE TRIGGER task_parent_acyclic BEFORE UPDATE OF parent_id ON tasks WHEN NEW.parent_id IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'Цикл подзадач') WHERE EXISTS(WITH RECURSIVE chain(id) AS(SELECT NEW.parent_id UNION SELECT t.parent_id FROM tasks t JOIN chain c ON t.id=c.id WHERE t.parent_id IS NOT NULL)SELECT 1 FROM chain WHERE id=NEW.id);
END;
CREATE TRIGGER frozen_snapshot_item BEFORE UPDATE ON weekly_snapshot_items BEGIN SELECT RAISE(ABORT,'Исходный план заморожен'); END;
`;
