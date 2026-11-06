import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SecretData, SecretVault } from "./types.ts";
import { CalendarError } from "./types.ts";
interface Storage { isEncryptionAvailable():boolean; encryptString(s:string):Buffer; decryptString(b:Buffer):string; }
/** Electron safeStorage uses Windows DPAPI. This file is outside exported app backups. */
export class WindowsTokenVault implements SecretVault {
  constructor(private file:string,private storage:Storage,private platform=process.platform) {}
  available() { return this.platform==="win32" && this.storage.isEncryptionAvailable(); }
  read():SecretData {
    if(!this.available())throw new CalendarError("secure");
    try {
      if(!fs.existsSync(this.file))return {};
      const bytes=fs.readFileSync(this.file);
      if(bytes.length>128*1024)throw new CalendarError("secure");
      const value=JSON.parse(this.storage.decryptString(bytes));
      if(!value || typeof value!=="object")throw new CalendarError("secure");
      return value;
    } catch {throw new CalendarError("secure");}
  }
  write(value:SecretData) {
    if(!this.available())throw new CalendarError("secure");
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const temp=this.file+"."+randomUUID()+".tmp";
    try {fs.writeFileSync(temp,this.storage.encryptString(JSON.stringify(value)),{flag:"wx",mode:0o600});fs.renameSync(temp,this.file);}
    catch {try{fs.unlinkSync(temp);}catch{/* Expected cancellation or encrypted-temp cleanup; no raw errors are logged. */}throw new CalendarError("secure");}
  }
  clearTokens() {
    if(!this.available()) {if(fs.existsSync(this.file))fs.unlinkSync(this.file);return;}
    let current:SecretData;
    try {current=this.read();} catch {if(fs.existsSync(this.file))fs.unlinkSync(this.file);return;}
    this.write({client:current.client});
  }
}
