import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import electron from "electron";
const results = [];
const root = process.cwd();
for (const [version, commit] of [
  ["0.2.0", "d9e8446"],
  ["0.3.0", "ab86f30"],
]) {
  const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "focus-rc-migration-"),
    ),
    source = path.join(directory, "source");
  fs.mkdirSync(source);
  const archive = execFileSync("git", ["archive", commit, "packages"]);
  execFileSync("tar", ["-xf", "-", "-C", source], { input: archive });
  const older = path.resolve("release", `rc-baseline-${version}.cjs`),
    current = path.resolve("release/rc-current-store.cjs");
  await build({
    entryPoints: [path.join(source, "packages/database/index.ts")],
    outfile: older,
    bundle: true,
    platform: "node",
    format: "cjs",
    nodePaths: [path.resolve("node_modules")],
    external: ["better-sqlite3"],
  });
  await build({
    entryPoints: ["packages/database/index.ts"],
    outfile: current,
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["better-sqlite3"],
  });
  const worker = path.resolve("release/rc-migration-worker.cjs");
  fs.writeFileSync(
    worker,
    `const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');const {Store:Old}=require(process.argv[2]),{Store:Current}=require(process.argv[3]);const dir=process.argv[4],version=process.argv[5],file=path.join(dir,'focus.db');let db=new Old(file);db.command({type:'importStudy'});const id=crypto.randomUUID(),stamp=new Date().toISOString();const item={id,kind:'task',title:'Original '+version,description:'Preserved',status:'week',priority:2,estimate:45,weight:3,date:'2026-11-03',time:null,due:'2026-11-04',projectId:null,category:'Migration',tags:'original',duration:0,distance:null,data:'',createdAt:stamp,completedAt:null,deletedAt:null};db.command({type:'save',item});db.attach(id,'proof.txt','text/plain',Buffer.from('original bytes'));const g=db.state().groups[0];db.command({type:'stage',groupId:g.id,row:0,column:0,status:'unknown'});const before=db.state(),records=JSON.parse(db.dump(true)).records;db.close();db=new Current(file);const after=db.state();assert.deepEqual(after.items,before.items);assert.deepEqual(after.subjects,before.subjects);assert.deepEqual(after.groups,before.groups);assert.deepEqual(after.attachments,before.attachments);assert.deepEqual(JSON.parse(db.dump(true)).records,records);assert.equal(after.groups.flatMap(g=>g.values.flat()).length,54);assert.deepEqual(db.db.pragma('foreign_key_check'),[]);assert.equal(after.diagnostics.integrity,'ok');assert.equal(db.db.prepare('SELECT content FROM attachments').get().content.toString(),'original bytes');console.log(JSON.stringify({version,passed:true,beforeSchema:before.diagnostics.version,afterSchema:after.diagnostics.version,exactRecordsPreserved:records.length,subjects:after.subjects.length,groups:after.groups.length,statuses:54,attachmentBytesPreserved:true,migrationBackup:db.migrationBackup?true:false}));db.close();`,
  );
  const output = execFileSync(
    electron,
    [worker, older, current, directory, version],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8" },
  );
  results.push(JSON.parse(output));
  fs.rmSync(directory, { recursive: true, force: true });
}
fs.writeFileSync(
  path.join(root, "docs/reports/1.0-rc/M4/migrations.json"),
  JSON.stringify(
    {
      passed: true,
      platform: process.platform,
      windowsInstallerTested: false,
      method:
        "actual baseline Store modules extracted from frozen commits; only temporary databases opened",
      results,
    },
    null,
    2,
  ),
);
console.log(results);
