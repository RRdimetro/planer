import { _electron as electron, expect } from '@playwright/test';
import { build } from 'esbuild';
import electronPath from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
if(process.platform!=='win32')throw Error('Native Windows verification is required.');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'focus-calendar-windows-'));
const reportDir=path.resolve('docs/reports/google-calendar'),screens=path.join(reportDir,'screenshots');
fs.mkdirSync(screens,{recursive:true});
const fixture=path.resolve('.calendar-test-fixture.cjs');
await build({entryPoints:['scripts/google-calendar-fixture.ts'],outfile:fixture,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const prepared=spawnSync(electronPath,[fixture,path.join(folder,'focus.db')],{encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
if(prepared.status!==0)throw Error('Isolated native fixture creation failed: '+prepared.stderr);
const launch=()=>electron.launch({args:['.'],env:{...process.env,FOCUS_DATA_DIR:folder,FOCUS_DEMO:'0',FOCUS_HOME_CONCEPT:'',FOCUS_DEMO_EMPTY:'0'}});
let app=await launch();
try {
  let page=await app.firstWindow();await page.waitForFunction(()=>Boolean(window.focusAPI));
  await expect(page.getByRole('heading',{name:'Главная',exact:true})).toBeVisible();
  const dpapi=await app.evaluate(({safeStorage})=>{
    if(!safeStorage.isEncryptionAvailable())return {available:false,roundTrip:false,plaintext:false};
    const marker='FOCUS_TEST_ONLY_SENTINEL';const bytes=safeStorage.encryptString(marker);
    return {available:true,roundTrip:safeStorage.decryptString(bytes)===marker,plaintext:bytes.includes(Buffer.from(marker))};
  });
  assert.deepEqual(dpapi,{available:true,roundTrip:true,plaintext:false});
  let state=await page.evaluate(()=>window.focusAPI.state());
  assert.equal(state.items.filter(x=>x.kind==='task').length,1);assert.equal(state.subjects[0].rkDone,1);
  assert.equal(state.googleCalendar.cachedEvents,1);assert.equal(state.items.filter(x=>x.category==='commute').length,2);
  await expect(page.locator('.google-calendar').filter({hasText:'TEST_ONLY university class'})).toBeVisible();
  await page.screenshot({path:path.join(screens,'home.png')});
  await page.locator('nav').getByRole('button',{name:'Планировщик',exact:true}).click();
  for(const [name,file]of [['День','day'],['Неделя','week'],['Месяц','month']]) {
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.google-calendar').filter({hasText:'TEST_ONLY university class'}).first()).toBeVisible();
    await page.screenshot({path:path.join(screens,file+'.png')});
  }
  const readOnly=await page.evaluate(async()=>{const s=await window.focusAPI.state();const i=s.items.find(x=>x.category==='university');try{await window.focusAPI.command({type:'save',item:{...i,title:'MUST_NOT_WRITE'}});return false;}catch{return true;}});
  assert.equal(readOnly,true);
  await page.locator('nav').getByRole('button',{name:'Настройки',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Google Calendar',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(screens,'settings.png')});
  const before=(await page.evaluate(()=>window.focusAPI.state()));
  await app.close();app=await launch();page=await app.firstWindow();await page.waitForFunction(()=>Boolean(window.focusAPI));
  state=await page.evaluate(()=>window.focusAPI.state());
  assert.deepEqual(state.items,before.items);assert.deepEqual(state.subjects,before.subjects);
  assert.equal(state.diagnostics.integrity,'ok');assert.equal(state.diagnostics.version,6);
  fs.writeFileSync(path.join(reportDir,'windows.json'),JSON.stringify({platform:process.platform,dpapi,views:['home','day','week','month','settings'],readOnly:true,restartPersistence:true,oldTaskAndStudyStatusPreserved:true,realGoogleOAuth:'NOT_RUN_REQUIRES_USER_CLIENT_AND_CONSENT',at:new Date().toISOString()},null,2));
  console.log('Native Windows DPAPI, offline Google projection, read-only UI, all calendar views and persistence: PASS. Real Google OAuth remains a separate required user test.');
} finally {
  await app.close();
  assert.ok(path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep));
  fs.rmSync(folder,{recursive:true,force:true});
  fs.unlinkSync(fixture);
}
