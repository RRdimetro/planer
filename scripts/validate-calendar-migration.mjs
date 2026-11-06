import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { calendarSQL } from '../packages/google-calendar/repository.ts';
const [sourceFile,output]=process.argv.slice(2);
assert.ok(sourceFile&&output,'Specify source SQLite and a NEW validation directory.');
assert.notEqual(path.resolve(sourceFile),path.join(path.resolve(output),'migration.sqlite'));
fs.mkdirSync(output,{recursive:false});
const saved=path.join(output,'before-migration.sqlite'),copy=path.join(output,'migration.sqlite');
const source=new DatabaseSync(sourceFile,{readOnly:true});
try {await backup(source,saved);}finally{source.close();}
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalHash=digest(saved);
let db=new DatabaseSync(saved,{readOnly:true});
assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
const tables=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x=>x.name);
const before=Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT * FROM "${t}"`).all()]));
assert.equal(Math.max(...before.schema_migrations.map(x=>x.version)),5,'Expected the installed schema v5.');
db.close();fs.copyFileSync(saved,copy,fs.constants.COPYFILE_EXCL);
db=new DatabaseSync(copy);db.exec('PRAGMA foreign_keys=ON; BEGIN');
try {db.exec(calendarSQL);db.prepare('INSERT INTO schema_migrations VALUES(6,?)').run(new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');db.close();throw e;}
for(const [name,rows]of Object.entries(before)) {
  const after=db.prepare(`SELECT * FROM "${name}"`).all();
  if(name==='schema_migrations')assert.deepEqual(after.filter(x=>x.version!==6),rows);
  else assert.deepEqual(after,rows,`Pre-existing data changed: ${name}`);
}
assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();
db=new DatabaseSync(copy,{readOnly:true});assert.equal(db.prepare('SELECT max(version) v FROM schema_migrations').get().v,6);db.close();
assert.equal(digest(saved),originalHash,'Pre-migration backup changed.');
const report={at:new Date().toISOString(),sourceOpenedReadOnly:true,migrationAppliedOnlyToCopy:true,backupSha256:originalHash,preexistingTables:tables.length,preexistingRowsPreserved:true,integrity:'ok',foreignKeyErrors:0,reopenSchema:6,counts:Object.fromEntries(['tasks','projects','study_subjects','study_aggregate_counts','attachments'].map(t=>[t,before[t].length]))};
fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
