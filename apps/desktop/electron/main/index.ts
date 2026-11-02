import {app,BrowserWindow,ipcMain,dialog,Notification,shell} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import AdmZip from 'adm-zip';
import {Store} from '../../../../packages/database';
import {commandSchema} from '../../../../packages/contracts';
if(process.env.FOCUS_DATA_DIR)app.setPath('userData',process.env.FOCUS_DATA_DIR);
let store:Store;let timer:NodeJS.Timeout;let last=performance.now();
app.whenReady().then(()=>{fs.mkdirSync(app.getPath('userData'),{recursive:true});store=new Store(path.join(app.getPath('userData'),'focus.db'));
 const win=new BrowserWindow({width:1440,height:960,minWidth:1000,minHeight:680,backgroundColor:'#090F0C',title:'FOCUS OS PRO',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(url!==win.webContents.getURL())event.preventDefault();});
 ipcMain.handle('focus:state',()=>store.state());ipcMain.handle('focus:command',async(event,input)=>{if(event.sender!==win.webContents)throw Error('Доступ запрещён');const c=commandSchema.parse(input);try{
 if(c.type!=='file')return store.command(c);
 if(c.action==='openData'){await shell.openPath(app.getPath('userData'));return store.state();}
 if(c.action==='backup'){const result=await dialog.showSaveDialog(win,{defaultPath:'FOCUS-backup.zip',filters:[{name:'ZIP',extensions:['zip']}]});if(result.filePath){const zip=new AdmZip();zip.addFile('manifest.json',Buffer.from(JSON.stringify({app:'FOCUS OS PRO',schema:1,at:new Date().toISOString()})));zip.addFile('data.json',Buffer.from(store.dump()));zip.writeZip(result.filePath);}}
 if(c.action==='restore'){const result=await dialog.showOpenDialog(win,{filters:[{name:'ZIP',extensions:['zip']}],properties:['openFile']});if(result.filePaths[0]){const zip=new AdmZip(result.filePaths[0]);const manifest=JSON.parse(zip.readAsText('manifest.json'));if(manifest.schema!==1||manifest.app!=='FOCUS OS PRO')throw Error('Несовместимая копия');const answer=await dialog.showMessageBox(win,{type:'warning',message:'Заменить текущие данные резервной копией?',buttons:['Отмена','Восстановить'],defaultId:0,cancelId:0});if(answer.response===1){fs.writeFileSync(path.join(app.getPath('userData'),'before-restore.json'),store.dump());store.restore(zip.readAsText('data.json'));}}}
 if(c.action==='export'||c.action==='exportNote'){const note=store.state().items.find(i=>i.id===c.id&&i.kind==='note');const r=await dialog.showSaveDialog(win,{defaultPath:c.action==='export'?'FOCUS-data.json':'Заметка.md'});if(r.filePath)fs.writeFileSync(r.filePath,c.action==='export'?store.dump():note?.description??'');}
 if(c.action==='import'){const r=await dialog.showOpenDialog(win,{filters:[{name:'JSON',extensions:['json']}],properties:['openFile']});if(r.filePaths[0]){const answer=await dialog.showMessageBox(win,{type:'warning',message:'Импорт заменит все текущие данные. Продолжить?',buttons:['Отмена','Импортировать'],cancelId:0});if(answer.response===1)store.restore(fs.readFileSync(r.filePaths[0],'utf8'));}}
 return store.state();}catch(e){fs.appendFileSync(path.join(app.getPath('userData'),'errors.log'),`${new Date().toISOString()} ${String(e)}\n`);throw e;}});
 timer=setInterval(()=>{const now=performance.now();const delta=(now-last)/1000;last=now;const s=store.state().sessions.find(s=>s.state==='running');if(!s||delta>3)return;s.seconds+=delta;if(s.target&&s.seconds>=s.target){s.seconds=s.target;s.state='done';if(Notification.isSupported())new Notification({title:'FOCUS OS PRO',body:'Фокус-сессия завершена. Время отдохнуть.'}).show();}store.put('session',s);},1000);
 if(process.env.FOCUS_DEV_URL)win.loadURL(process.env.FOCUS_DEV_URL);else win.loadFile(path.join(__dirname,'../dist/index.html'));
});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{clearInterval(timer);store?.close();});
