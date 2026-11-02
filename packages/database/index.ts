import Database from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import {randomUUID} from 'node:crypto';
import * as schema from './schema';
import {commandSchema,type Command,type State,type Item} from '../contracts';
export class Store {
 readonly db:Database.Database; readonly orm; private undoStack:string[]=[];
 constructor(path:string){this.db=new Database(path);this.db.pragma('journal_mode=WAL');this.db.pragma('foreign_keys=ON');this.orm=drizzle(this.db,{schema});this.db.transaction(()=>{
 this.db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)));CREATE INDEX IF NOT EXISTS records_kind ON records(kind);CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,payload TEXT NOT NULL CHECK(json_valid(payload)));CREATE TABLE IF NOT EXISTS change_log(id INTEGER PRIMARY KEY,at TEXT NOT NULL,action TEXT NOT NULL,before_json TEXT,after_json TEXT);`);
 this.db.prepare('INSERT OR IGNORE INTO schema_migrations VALUES(1,?)').run(new Date().toISOString());})();
 this.db.prepare("UPDATE records SET payload=json_set(payload,'$.state','interrupted') WHERE kind='session' AND json_extract(payload,'$.state')='running'").run();}
 put<T extends {id:string}>(kind:string,item:T){this.orm.insert(schema.records).values({id:item.id,kind,payload:JSON.stringify(item)}).onConflictDoUpdate({target:schema.records.id,set:{kind,payload:JSON.stringify(item)}}).run();}
 list<T>(kind:string):T[]{return this.orm.select().from(schema.records).where(eq(schema.records.kind,kind)).all().map(r=>JSON.parse(r.payload));}
 setting(key:string,value:unknown){this.orm.insert(schema.settings).values({key,payload:JSON.stringify(value)}).onConflictDoUpdate({target:schema.settings.key,set:{payload:JSON.stringify(value)}}).run();}
 state():State{return {items:['task','project','event','workout','note','snapshot'].flatMap(k=>this.list<Item>(k)).filter(i=>!i.deletedAt),subjects:this.list('subject'),groups:this.list('group'),sessions:this.list('session'),settings:Object.fromEntries(this.orm.select().from(schema.settings).all().map(r=>[r.key,JSON.parse(r.payload)])),diagnostics:{version:1,integrity:String(this.db.pragma('quick_check',{simple:true}))}};}
 dump(){return JSON.stringify({records:this.orm.select().from(schema.records).all(),settings:this.orm.select().from(schema.settings).all()});}
 restore(raw:string){const d=JSON.parse(raw);if(!Array.isArray(d.records)||!Array.isArray(d.settings))throw Error('Неверный формат резервной копии');this.db.transaction(()=>{this.db.exec('DELETE FROM records;DELETE FROM settings;');for(const r of d.records){if(typeof r.id!=='string'||typeof r.kind!=='string')throw Error('Повреждённая запись');JSON.parse(r.payload);this.db.prepare('INSERT INTO records VALUES(?,?,?)').run(r.id,r.kind,r.payload);}for(const s of d.settings){JSON.parse(s.payload);this.db.prepare('INSERT INTO settings VALUES(?,?)').run(s.key,s.payload);}})();}
 command(input:Command):State {const c=commandSchema.parse(input);if(c.type==='file')throw Error('Файловая операция доступна только в desktop');if(c.type==='undo'){const prev=this.undoStack.pop();if(prev)this.restore(prev);return this.state();}const before=this.dump();this.db.transaction(()=>{switch(c.type){
 case 'save':{const old=this.list<Item>(c.item.kind).find(t=>t.id===c.item.id);const item={...c.item,createdAt:old?.createdAt??c.item.createdAt,completedAt:c.item.status==='done'?(old?.completedAt??new Date().toISOString()):null};this.put(item.kind,item);break;}
 case 'remove':{const r=this.db.prepare('SELECT kind,payload FROM records WHERE id=?').get(c.id) as {kind:string;payload:string}|undefined;if(r){const item=JSON.parse(r.payload);this.put(r.kind,{...item,deletedAt:new Date().toISOString()});}break;}
 case 'settings':this.setting(c.key,c.value);break;
 case 'importStudy':seedStudy(this);break;
 case 'subject':this.put('subject',c.subject);break;
 case 'removeSubject':this.db.prepare("DELETE FROM records WHERE id=? OR (kind='group' AND json_extract(payload,'$.subjectId')=?)").run(c.id,c.id);break;
 case 'stage':{const g=this.state().groups.find(g=>g.id===c.groupId);if(!g||g.values[c.row]?.[c.column]===undefined)throw Error('Этап не найден');g.values[c.row][c.column]=c.status;this.put('group',g);break;}
 case 'addGroup':if(!this.state().subjects.some(s=>s.id===c.subjectId))throw Error('Предмет не найден');this.put('group',{id:randomUUID(),subjectId:c.subjectId,name:c.name,stages:c.stages,values:c.stages.map(()=>Array(c.count).fill('unknown'))});break;
 case 'snapshot':{const existing=this.list<Item>('snapshot').some(s=>s.date===c.week);if(existing)throw Error('Исходный план этой недели уже зафиксирован');this.put('snapshot',{id:randomUUID(),kind:'snapshot',title:'Исходный план',date:c.week,data:JSON.stringify(this.state().items.filter(t=>t.kind==='task'&&(t.status==='week'||t.date&&t.date>=c.week&&t.date<=new Date(Date.parse(c.week)+6*86400000).toISOString().slice(0,10))))} as Item);break;}
 case 'focusStart':if(this.state().sessions.some(s=>s.state==='running'||s.state==='paused'))throw Error('Сначала завершите текущую сессию');this.put('session',{id:randomUUID(),taskId:c.taskId,startedAt:new Date().toISOString(),seconds:0,state:'running',target:c.target});break;
 case 'focusAction':{const s=this.state().sessions.find(s=>['running','paused','interrupted'].includes(s.state));if(!s)throw Error('Нет активной сессии');s.state=c.action==='finish'?'done':c.action==='pause'?'paused':'running';this.put('session',s);break;}
 }this.db.prepare('INSERT INTO change_log(at,action,before_json,after_json) VALUES(?,?,?,?)').run(new Date().toISOString(),c.type,before,this.dump());})();this.undoStack.push(before);if(this.undoStack.length>30)this.undoStack.shift();return this.state();}
 close(){this.db.close();}
}
export function seedStudy(store:Store){if(store.state().subjects.length)return;
 const rows:[string,number,number,number,number][]=[['АСОИУ',0,1,0,0],['Англ яз',1,3,1,1],['Модели данных',0,1,0,1],['Программирование',0,2,0,1],['Правоведение',1,2,0,1],['Теорвер',0,3,1,3],['Физика',0,2,1,4],['Экология',0,2,0,2],['Электротехника',2,4,0,1]];
 const ids=rows.map(([name,rkDone,rkTotal,hwDone,hwTotal])=>{const id=randomUUID();store.put('subject',{id,name,rkDone,rkTotal,hwDone,hwTotal,exam:null,grade:null});return id;});
 const defs:[string,number,string[],string[]][]=[['Физика лабы',6,['Написана','Выполнена','Защищена'],['++++--','++++--','+++---']],['Физика ДЗ',6,['Решена','Сдана','Защита теор','Защита прак'],['++??','++??','+???','++??']],['ЭлТех лабы',8,['Выполнена','Защищена'],['++??','++??']],['МД лабы',2,['Выполнена','Защищена'],['++----','++----']]];
 for(const [name,index,stages,values]of defs)store.put('group',{id:randomUUID(),subjectId:ids[index],name,stages,values:values.map(row=>[...row].map(s=>s==='+'?'done':s==='-'?'not_done':'unknown'))});
 store.setting('onboarded',true);
}
