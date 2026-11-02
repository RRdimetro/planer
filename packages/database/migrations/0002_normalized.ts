export const version = 2;
export const sql = `
CREATE TABLE entities (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('project','task','event','note','workout')),
 title TEXT NOT NULL CHECK(length(trim(title))>0),description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('backlog','week','today','active','done')),
 priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 4),estimate REAL NOT NULL CHECK(estimate>=0),
 weight REAL NOT NULL CHECK(weight>0),planned_date TEXT,planned_time TEXT,due TEXT,
 category TEXT NOT NULL,tags TEXT NOT NULL,metadata TEXT NOT NULL CHECK(json_valid(metadata)),
 created_at TEXT NOT NULL,completed_at TEXT,deleted_at TEXT
);
CREATE INDEX entities_schedule ON entities(planned_date,planned_time) WHERE deleted_at IS NULL;
CREATE INDEX entities_kind_status ON entities(kind,status) WHERE deleted_at IS NULL;
CREATE TABLE projects(id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,linked_project_id TEXT REFERENCES projects(id));
CREATE TABLE tasks(id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,project_id TEXT REFERENCES projects(id),parent_id TEXT REFERENCES tasks(id),weekly_week TEXT,recurrence_root_id TEXT REFERENCES tasks(id),occurrence_date TEXT,CHECK(parent_id IS NULL OR parent_id<>id),UNIQUE(recurrence_root_id,occurrence_date));
CREATE INDEX tasks_project ON tasks(project_id);
CREATE INDEX tasks_parent ON tasks(parent_id);
CREATE TABLE calendar_events(id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,project_id TEXT REFERENCES projects(id),event_type TEXT NOT NULL);
CREATE TABLE notes(id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,project_id TEXT REFERENCES projects(id));
CREATE TABLE workout_programs(id TEXT PRIMARY KEY,name TEXT NOT NULL CHECK(length(trim(name))>0),description TEXT NOT NULL DEFAULT '');
CREATE TABLE workouts(id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,project_id TEXT REFERENCES projects(id),duration REAL NOT NULL CHECK(duration>=0),distance REAL CHECK(distance>=0),program_id TEXT REFERENCES workout_programs(id));
CREATE TABLE task_checklist(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,title TEXT NOT NULL CHECK(length(trim(title))>0),done INTEGER NOT NULL CHECK(done IN(0,1)),position INTEGER NOT NULL,UNIQUE(task_id,position));
CREATE TABLE task_dependencies(task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,depends_on_id TEXT NOT NULL REFERENCES tasks(id),PRIMARY KEY(task_id,depends_on_id),CHECK(task_id<>depends_on_id));
CREATE TABLE recurrence_rules(task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,frequency TEXT NOT NULL CHECK(frequency IN('daily','weekly','monthly')),interval INTEGER NOT NULL CHECK(interval BETWEEN 1 AND 365),until_date TEXT);
CREATE TABLE focus_sessions(id TEXT PRIMARY KEY,task_id TEXT REFERENCES tasks(id),started_at TEXT NOT NULL,seconds REAL NOT NULL CHECK(seconds>=0),state TEXT NOT NULL CHECK(state IN('running','paused','done','interrupted')),target INTEGER NOT NULL CHECK(target>=0));
CREATE INDEX focus_task ON focus_sessions(task_id);
CREATE TABLE study_subjects(id TEXT PRIMARY KEY,name TEXT NOT NULL CHECK(length(trim(name))>0),exam TEXT,grade TEXT);
CREATE TABLE study_aggregate_counts(subject_id TEXT NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN('rk','hw')),total INTEGER NOT NULL CHECK(total>=0),completed INTEGER NOT NULL CHECK(completed>=0 AND completed<=total),PRIMARY KEY(subject_id,kind));
CREATE TABLE study_work_groups(id TEXT PRIMARY KEY,subject_id TEXT NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,name TEXT NOT NULL);
CREATE TABLE study_works(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES study_work_groups(id) ON DELETE CASCADE,number INTEGER NOT NULL CHECK(number>0),UNIQUE(group_id,number),UNIQUE(id,group_id));
CREATE TABLE study_stage_definitions(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES study_work_groups(id) ON DELETE CASCADE,name TEXT NOT NULL,position INTEGER NOT NULL CHECK(position>=0),UNIQUE(group_id,position),UNIQUE(id,group_id));
CREATE TABLE study_stage_status(group_id TEXT NOT NULL,work_id TEXT NOT NULL,stage_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('done','not_done','unknown')),updated_at TEXT NOT NULL,PRIMARY KEY(work_id,stage_id),FOREIGN KEY(work_id,group_id) REFERENCES study_works(id,group_id) ON DELETE CASCADE,FOREIGN KEY(stage_id,group_id) REFERENCES study_stage_definitions(id,group_id) ON DELETE CASCADE);
CREATE TABLE weekly_snapshots(id TEXT PRIMARY KEY,week TEXT NOT NULL UNIQUE,title TEXT NOT NULL,created_at TEXT NOT NULL,metadata TEXT NOT NULL CHECK(json_valid(metadata)));
CREATE TABLE weekly_snapshot_items(snapshot_id TEXT NOT NULL REFERENCES weekly_snapshots(id) ON DELETE CASCADE,task_id TEXT NOT NULL REFERENCES tasks(id),weight REAL NOT NULL CHECK(weight>0),estimate REAL NOT NULL CHECK(estimate>=0),due TEXT,title TEXT NOT NULL,details TEXT NOT NULL CHECK(json_valid(details)),PRIMARY KEY(snapshot_id,task_id));
CREATE TABLE completion_facts(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),at TEXT NOT NULL,title TEXT NOT NULL,estimate REAL NOT NULL CHECK(estimate>=0),weight REAL NOT NULL CHECK(weight>0),due TEXT,details TEXT NOT NULL CHECK(json_valid(details)));
CREATE TABLE attachments(id TEXT PRIMARY KEY,entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,name TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL CHECK(size>=0 AND size<=26214400),content BLOB NOT NULL,created_at TEXT NOT NULL,CHECK(length(content)=size));
CREATE TABLE exercises(id TEXT PRIMARY KEY,name TEXT NOT NULL CHECK(length(trim(name))>0),muscle_group TEXT NOT NULL DEFAULT '');
CREATE TABLE program_exercises(id TEXT PRIMARY KEY,program_id TEXT NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,exercise_id TEXT NOT NULL REFERENCES exercises(id),target_sets INTEGER NOT NULL CHECK(target_sets>0),target_reps INTEGER NOT NULL CHECK(target_reps>0),target_weight REAL NOT NULL CHECK(target_weight>=0),position INTEGER NOT NULL);
CREATE TABLE workout_sets(id TEXT PRIMARY KEY,workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,exercise_id TEXT NOT NULL REFERENCES exercises(id),position INTEGER NOT NULL CHECK(position>=0),reps INTEGER NOT NULL CHECK(reps>=0),weight REAL NOT NULL CHECK(weight>=0),done INTEGER NOT NULL CHECK(done IN(0,1)),UNIQUE(workout_id,exercise_id,position));
CREATE TABLE planning_constraints(id TEXT PRIMARY KEY,label TEXT NOT NULL,date TEXT,weekday INTEGER CHECK(weekday BETWEEN 1 AND 7),start_min INTEGER NOT NULL CHECK(start_min BETWEEN 0 AND 1439),end_min INTEGER NOT NULL CHECK(end_min BETWEEN 1 AND 1440),kind TEXT NOT NULL CHECK(kind IN('blocked','no_complex')),CHECK(end_min>start_min),CHECK(date IS NOT NULL OR weekday IS NOT NULL));
CREATE TABLE entity_changes(id TEXT PRIMARY KEY,entity_id TEXT REFERENCES entities(id),at TEXT NOT NULL,action TEXT NOT NULL,before_json TEXT,after_json TEXT);
CREATE INDEX entity_changes_entity ON entity_changes(entity_id,at);
CREATE TABLE project_milestones(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title TEXT NOT NULL,due TEXT,done INTEGER NOT NULL CHECK(done IN(0,1)));
`;
