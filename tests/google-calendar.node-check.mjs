import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { CalendarRepository, calendarSQL } from '../packages/google-calendar/repository.ts';
import { projectCalendarEvents } from '../packages/google-calendar/projection.ts';
import { GoogleCalendarService } from '../packages/google-calendar/service.ts';
import { DesktopOAuth, parseDesktopClient } from '../packages/google-calendar/oauth.ts';
import { WindowsTokenVault } from '../packages/google-calendar/vault.ts';
import { READ_SCOPES, CALENDAR_NAME } from '../packages/google-calendar/types.ts';
import { canSchedule } from '../packages/core/index.ts';

const calendar={id:'test-calendar',summary:CALENDAR_NAME,timeZone:'Europe/Moscow'};
const event=(id,start='2026-11-06T10:00:00+03:00',end='2026-11-06T11:30:00+03:00',extra={})=>({id,summary:'Название из Google',start:{dateTime:start,timeZone:'Europe/Moscow'},end:{dateTime:end,timeZone:'Europe/Moscow'},...extra});
const response=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers});
function fixture() {
  const raw=new DatabaseSync(':memory:');raw.exec('PRAGMA foreign_keys=ON; CREATE TABLE change_log(id INTEGER PRIMARY KEY,at TEXT,action TEXT,before_json TEXT,after_json TEXT); CREATE TABLE user_tasks(id TEXT PRIMARY KEY,title TEXT); INSERT INTO user_tasks VALUES(\'original\',\'Моя задача\'); CREATE TABLE study_status(id TEXT PRIMARY KEY,status TEXT); INSERT INTO study_status VALUES(\'original\',\'done\');');
  const db={prepare:s=>raw.prepare(s),exec:s=>raw.exec(s),transaction:fn=>(...args)=>{const nested=raw.isTransaction;const name='s'+crypto.randomBytes(4).toString('hex');raw.exec(nested?'SAVEPOINT '+name:'BEGIN');try{const r=fn(...args);raw.exec(nested?'RELEASE '+name:'COMMIT');return r;}catch(e){raw.exec(nested?'ROLLBACK TO '+name:'ROLLBACK');if(nested)raw.exec('RELEASE '+name);throw e;}}};
  db.exec(calendarSQL);const repo=new CalendarRepository(db);repo.select(calendar);
  let secret={client:{clientId:'TEST_ONLY.apps.googleusercontent.com'},tokens:{accessToken:'TEST_ONLY_ACCESS',refreshToken:'TEST_ONLY_REFRESH',expiresAt:Date.now()+3600000}};
  const vault={read:()=>structuredClone(secret),write:v=>{secret=structuredClone(v);},clearTokens:()=>{secret={client:secret.client};},available:()=>true};
  const oauth={authorize:async()=>({accessToken:'TEST_ONLY_NEW',refreshToken:'TEST_ONLY_REFRESH',expiresAt:Date.now()+3600000}),cancel:()=>{}};
  return {raw,repo,vault,oauth,close:()=>raw.close()};
}
function service(f,fetcher) {return new GoogleCalendarService(f.repo,f.vault,f.oauth,fetcher,()=>Date.parse('2026-11-06T00:00:00Z'),async()=>{});}
function commit(f,events) {f.repo.commit({generation:f.repo.settings().generation,calendarId:calendar.id,full:true,events,occurrences:events,syncToken:'SYNC_TEST',windowStart:'2026-01-01T00:00:00Z',windowEnd:'2027-12-31T00:00:00Z',now:'2026-11-06T00:00:00Z'});}

test('full sync, recurrence IDs, metadata and idempotent repeat; no writes to Google or user data',async()=>{
  const f=fixture();try{
    const instances=[event('series_20261106'),event('other','2026-11-06T13:00:00+03:00','2026-11-06T14:30:00+03:00',{description:'Только исходное описание',location:'Исходное место',recurringEventId:'series',originalStartTime:{dateTime:'2026-11-06T13:00:00+03:00'}})];
    const seen=[];const fetcher=async(url,options)=>{seen.push({url:String(url),method:options.method});const u=new URL(url);return response(u.searchParams.get('singleEvents')==='true'?{items:instances}:{items:[event('series',undefined,undefined,{recurrence:['RRULE:FREQ=WEEKLY;INTERVAL=2']})],nextSyncToken:'SYNC_TEST'});};
    const s=service(f,fetcher);await s.sync();await s.sync();assert.equal(f.repo.occurrences(calendar.id).length,2);
    assert.ok(seen.every(x=>x.method==='GET'));assert.ok(seen.some(x=>x.url.includes('syncToken=SYNC_TEST')));
    const raw=JSON.parse(f.raw.prepare('SELECT raw_json FROM google_calendar_events WHERE event_id=?').get('series').raw_json);assert.deepEqual(raw.recurrence,['RRULE:FREQ=WEEKLY;INTERVAL=2']);
    const cached=f.repo.occurrences(calendar.id).find(x=>x.event.id==='other');assert.equal(cached.event.location,'Исходное место');assert.equal(cached.event.recurringEventId,'series');
    assert.equal(f.raw.prepare('SELECT title FROM user_tasks').get().title,'Моя задача');assert.equal(f.raw.prepare('SELECT status FROM study_status').get().status,'done');
    assert.equal(f.raw.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(f.raw.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{f.close();}
});
test('moved instance, cancelled exception and deleted event update only Google cache',async()=>{
  const f=fixture();try{
    commit(f,[event('a'),event('b'),event('c')]);const changed=event('a','2026-11-07T12:00:00+03:00','2026-11-07T13:30:00+03:00',{recurringEventId:'series'});
    const s=service(f,async url=>response(new URL(url).searchParams.get('singleEvents')==='true'?{items:[changed,{id:'b',status:'cancelled'}]}:{items:[changed,{id:'b',status:'cancelled'},{id:'c',status:'cancelled'}],nextSyncToken:'SYNC_2'}));
    await s.sync();assert.deepEqual(f.repo.occurrences(calendar.id).map(x=>x.event.id),['a']);assert.equal(f.repo.occurrences(calendar.id)[0].event.start.dateTime,changed.start.dateTime);
    assert.equal(f.raw.prepare('SELECT count(*) n FROM user_tasks').get().n,1);
  }finally{f.close();}
});
test('all pagination completes before commit; a failed later page preserves cache and token',async()=>{
  const f=fixture();try{commit(f,[event('original')]);const old=f.repo.source(calendar.id);
    const s=service(f,async url=>{const u=new URL(url);if(u.searchParams.has('pageToken'))return response({},503);return response({items:[event('new')],nextPageToken:'PAGE_2'});});
    await assert.rejects(s.sync());assert.equal(f.repo.source(calendar.id).sync_token,old.sync_token);assert.deepEqual(f.repo.occurrences(calendar.id).map(x=>x.event.id),['original']);assert.ok(s.status().error);
  }finally{f.close();}
});
test('410 triggers staged full sync; failures never wipe an offline cache',async()=>{
  const f=fixture();try{commit(f,[event('old')]);let full=false;
    const s=service(f,async url=>{const u=new URL(url);if(u.searchParams.has('syncToken'))return response({},410);if(u.searchParams.get('singleEvents')==='false'){full=true;return response({items:[event('new')],nextSyncToken:'NEW_TOKEN'});}return response({items:[event('new')]});});
    await s.sync();assert.ok(full);assert.equal(f.repo.source(calendar.id).sync_token,'NEW_TOKEN');assert.equal(f.repo.occurrences(calendar.id)[0].event.id,'new');
    const offline=service(f,async()=>{throw Error('TEST_ONLY network failure');});await assert.rejects(offline.sync());assert.equal(f.repo.occurrences(calendar.id)[0].event.id,'new');assert.equal(offline.projected('Europe/Moscow').filter(x=>x.category==='university').length,1);
  }finally{f.close();}
});
test('expired access token refreshes; invalid_grant requests reconnect and retains data',async()=>{
  const f=fixture();try{commit(f,[event('saved')]);const secret=f.vault.read();secret.tokens.expiresAt=0;f.vault.write(secret);let refreshed=0;
    const s=service(f,async(url,options)=>{if(String(url).includes('oauth2.googleapis.com')){refreshed++;assert.equal(options.method,'POST');return response({access_token:'TEST_ONLY_REPLACED',expires_in:3600});}return response(new URL(url).searchParams.get('singleEvents')==='true'?{items:[event('saved')]}:{items:[],nextSyncToken:'NEXT'});});
    await s.sync();assert.equal(refreshed,1);assert.equal(f.vault.read().tokens.refreshToken,'TEST_ONLY_REFRESH');
    const again=f.vault.read();again.tokens.expiresAt=0;f.vault.write(again);const bad=service(f,async()=>response({error:'invalid_grant'},400));await assert.rejects(bad.sync());assert.match(bad.status().error,/повторное подключение/);assert.equal(f.repo.occurrences(calendar.id).length,1);
  }finally{f.close();}
});
test('disconnect discards an in-flight sync and token refresh cannot resurrect credentials',async()=>{
  const f=fixture();try{commit(f,[event('saved')]);let release;const gate=new Promise(r=>{release=r;});
    const s=service(f,async url=>{await gate;return response(new URL(url).searchParams.get('singleEvents')==='true'?{items:[event('late')]}:{items:[],nextSyncToken:'LATE'});});
    const pending=s.sync();s.disconnect();release();await assert.rejects(pending);assert.equal(f.repo.settings().enabled,false);assert.equal(f.vault.read().tokens,undefined);assert.equal(f.repo.occurrences(calendar.id)[0].event.id,'saved');
  }finally{f.close();}
});
test('exact calendar match and explicit choice for duplicate names',async()=>{
  const f=fixture();try{
    const s=service(f,async url=>{const u=new URL(url);if(u.pathname.endsWith('/calendarList'))return response({items:[calendar,{...calendar,id:'second'},{...calendar,id:'wrong',summary:'Расписание Дима'}]});return response(u.searchParams.get('singleEvents')==='true'?{items:[]}:{items:[],nextSyncToken:'NEW'});});
    await s.connect();assert.equal(s.status().choices.length,2);assert.equal(s.status().connected,false);await s.choose('second');assert.equal(f.repo.settings().calendar.id,'second');assert.equal(s.status().connected,true);
  }finally{f.close();}
});
test('travel occurs once before first and once after last class, changes with settings',()=>{
  const rows=[{localId:'a',event:event('a')},{localId:'b',event:event('b','2026-11-06T15:00:00+03:00','2026-11-06T16:30:00+03:00')}];
  const result=projectCalendarEvents(rows,calendar,'Europe/Moscow',90,90);const travel=result.filter(x=>x.category==='commute');assert.equal(travel.length,2);assert.deepEqual(travel.map(x=>x.time),['08:30','16:30']);assert.ok(travel.every(x=>x.estimate===90));
  const short=projectCalendarEvents(rows,calendar,'Europe/Moscow',30,0).filter(x=>x.category==='commute');assert.equal(short.length,1);assert.equal(short[0].time,'09:30');
  const task={...result[0],id:'task',kind:'task',estimate:30,date:'2026-11-06',time:'08:45',data:'{}',due:null};assert.equal(canSchedule(task,result,0,24,{lectureWork:true}),false);task.time='10:15';assert.equal(canSchedule(task,result,0,24,{lectureWork:true}),false);task.time='12:00';assert.equal(canSchedule(task,result,0,24),true);
});
test('timezone conversion, midnight splitting and exclusive all-day end are retained',()=>{
  const rows=[{localId:'cross',event:event('cross','2026-11-06T20:30:00Z','2026-11-06T22:30:00Z')}];const result=projectCalendarEvents(rows,calendar,'Europe/Moscow',0,0);assert.deepEqual(result.map(x=>[x.date,x.time,x.estimate]),[['2026-11-06','23:30',30],['2026-11-07','00:00',90]]);
  const allDay=projectCalendarEvents([{localId:'all',event:{id:'all',summary:'Из Google',start:{date:'2026-11-06'},end:{date:'2026-11-08'}}}],calendar,'Europe/Moscow',90,90);assert.equal(allDay.length,2);assert.ok(allDay.every(x=>x.time===null));assert.equal(allDay.filter(x=>x.category==='commute').length,0);
});
test('OAuth uses system-browser URL, PKCE S256, nonce and read-only scopes',async()=>{
  let challenge,observed;const oauth=new DesktopOAuth(async address=>{const u=new URL(address);observed=u;challenge=u.searchParams.get('code_challenge');const redirect=u.searchParams.get('redirect_uri');const bad=await fetch(redirect+'?code=TEST_ONLY_CODE&state=wrong');assert.equal(bad.status,400);await fetch(redirect+'?code=TEST_ONLY_CODE&state='+u.searchParams.get('state'));},async(_url,options)=>{const body=new URLSearchParams(options.body);assert.equal(crypto.createHash('sha256').update(body.get('code_verifier')).digest('base64url'),challenge);return response({access_token:'TEST_ONLY_ACCESS',refresh_token:'TEST_ONLY_REFRESH',expires_in:3600,scope:READ_SCOPES.join(' ')});});
  const result=await oauth.authorize({clientId:'TEST_ONLY.apps.googleusercontent.com'});assert.equal(observed.origin,'https://accounts.google.com');assert.equal(observed.searchParams.get('code_challenge_method'),'S256');assert.deepEqual(observed.searchParams.get('scope').split(' '),[...READ_SCOPES]);assert.ok(result.refreshToken);
  assert.throws(()=>parseDesktopClient('{"web":{}}'));assert.equal(parseDesktopClient('{"installed":{"client_id":"test.apps.googleusercontent.com"}}').clientId,'test.apps.googleusercontent.com');
});
test('vault refuses plaintext and non-Windows storage; encrypted persistence is atomic',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'focus-vault-test-'));const file=path.join(dir,'credentials.vault');const key=crypto.randomBytes(32);
  const storage={isEncryptionAvailable:()=>true,encryptString:s=>{const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,nonce);const body=Buffer.concat([cipher.update(s),cipher.final()]);return Buffer.concat([nonce,cipher.getAuthTag(),body]);},decryptString:b=>{const d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString();}};
  try{const vault=new WindowsTokenVault(file,storage,'win32');vault.write({client:{clientId:'TEST_ONLY.apps.googleusercontent.com'},tokens:{accessToken:'TEST_ONLY_ACCESS',refreshToken:'TEST_ONLY_REFRESH',expiresAt:1}});assert.equal(fs.readFileSync(file).includes(Buffer.from('TEST_ONLY_REFRESH')),false);assert.equal(vault.read().tokens.refreshToken,'TEST_ONLY_REFRESH');vault.clearTokens();assert.equal(vault.read().tokens,undefined);assert.throws(()=>new WindowsTokenVault(file,storage,'linux').read());assert.throws(()=>new WindowsTokenVault(file,{...storage,isEncryptionAvailable:()=>false},'win32').write({}));}finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});

test('rate limits retry with bounded backoff; error payloads never reach UI status',async()=>{
  const f=fixture();try{let calls=0;
    const s=service(f,async url=>{calls++;if(calls===1)return response({error:{errors:[{reason:'rateLimitExceeded'}],message:'TEST_ONLY_ACCESS'}},403);if(calls===2)return response({},429,{'Retry-After':'1'});return response(new URL(url).searchParams.get('singleEvents')==='true'?{items:[event('ok')]}:{items:[],nextSyncToken:'OK'});});
    await s.sync();assert.ok(calls>=4);assert.equal(f.repo.occurrences(calendar.id).length,1);assert.ok(!JSON.stringify(s.status()).includes('TEST_ONLY_ACCESS'));
  }finally{f.close();}
});
test('401 refreshes once without changing events or reusing a revoked token',async()=>{
  const f=fixture();try{let refreshes=0,unauthorized=false;
    const s=service(f,async(url,options)=>{if(String(url).includes('oauth2.googleapis.com')){refreshes++;return response({access_token:'TEST_ONLY_ROTATED',expires_in:3600});}if(!unauthorized){unauthorized=true;return response({},401);}assert.equal(options.headers.Authorization,'Bearer TEST_ONLY_ROTATED');return response(new URL(url).searchParams.get('singleEvents')==='true'?{items:[event('ok')]}:{items:[],nextSyncToken:'OK'});});
    await s.sync();assert.equal(refreshes,1);assert.equal(f.repo.occurrences(calendar.id).length,1);
  }finally{f.close();}
});
test('failed repository transaction restores both old events and the sync token',()=>{
  const f=fixture();try{commit(f,[event('saved')]);assert.throws(()=>f.repo.commit({generation:f.repo.settings().generation,calendarId:calendar.id,full:true,events:[event('new')],occurrences:[event('new'),{id:undefined}],syncToken:'INVALID',windowStart:'x',windowEnd:'y',now:'2026-11-06'}));assert.equal(f.repo.source(calendar.id).sync_token,'SYNC_TEST');assert.equal(f.repo.occurrences(calendar.id)[0].event.id,'saved');
  }finally{f.close();}
});
test('overnight classes do not generate travel in the middle of a continuous lesson',()=>{
  const output=projectCalendarEvents([{localId:'night',event:event('night','2026-11-06T23:30:00+03:00','2026-11-07T01:30:00+03:00')}],calendar,'Europe/Moscow',90,90);const travel=output.filter(x=>x.category==='commute');assert.equal(travel.length,2);assert.deepEqual(travel.map(x=>[x.date,x.time]),[['2026-11-06','22:00'],['2026-11-07','01:30']]);
  const autumn=projectCalendarEvents([{localId:'fold',event:event('fold','2026-10-25T02:30:00+02:00','2026-10-25T02:15:00+01:00')}],{...calendar,timeZone:'Europe/Berlin'},'Europe/Berlin',0,0);assert.ok(autumn[0].estimate>0);assert.equal(JSON.parse(autumn[0].data).externalCalendar.sourceStart.dateTime,'2026-10-25T02:30:00+02:00');
});

test('cache restore validates all calendars atomically and always disconnects restored credentials',()=>{
  const f=fixture();try {
    commit(f,[event('saved')]);const cache=f.repo.exportCache();
    f.repo.restoreCache(structuredClone(cache));assert.equal(f.repo.settings().enabled,false);assert.equal(f.repo.occurrences(calendar.id)[0].event.id,'saved');
    const before=f.repo.exportCache();
    for(const mutate of [
      c=>{c.settings[0].calendar_json=JSON.stringify({...calendar,timeZone:'Invalid/Zone'});},
      c=>{c.sources.push({...c.sources[0],calendar_id:'hidden'});c.events.push({calendar_id:'hidden',event_id:'invalid',raw_json:JSON.stringify({id:'invalid',start:{date:'2026-02-30'},end:{date:'2026-03-02'}})});},
      c=>{c.occurrences[0].local_id='another-id';},
      c=>{c.occurrences[0].original_start_json=JSON.stringify({date:'2026-11-01'});},
      c=>{c.settings[0].commute_before=-1;},
      c=>{c.events[0].raw_json='{malformed';},
    ]) {
      const broken=structuredClone(before);mutate(broken);assert.throws(()=>f.repo.restoreCache(broken));assert.deepEqual(f.repo.exportCache(),before);
      assert.equal(f.raw.prepare('SELECT title FROM user_tasks').get().title,'Моя задача');
    }
  } finally {f.close();}
});
