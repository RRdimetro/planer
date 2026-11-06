import type { Item } from "../contracts/index.ts";
import type { CalendarChoice, GoogleEvent } from "./types.ts";
import { CalendarError } from "./types.ts";
import { stableCalendarId } from "./repository.ts";

const formatters=new Map<string,Intl.DateTimeFormat>();
const starts=new Map<string,number>();
function parts(at: number, zone: string) {
  let formatter=formatters.get(zone);
  if(!formatter) {formatter=new Intl.DateTimeFormat("en-CA", {timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});formatters.set(zone,formatter);}
  const p = formatter.formatToParts(at);
  const get=(key:string)=>p.find(x=>x.type===key)!.value;
  return {date:`${get("year")}-${get("month")}-${get("day")}`,time:`${get("hour")}:${get("minute")}`,minute:Number(get("hour"))*60+Number(get("minute"))};
}
function nextDay(day:string) { const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10); }
function dayStart(day:string,zone:string) {
  const key=day+"/"+zone;const cached=starts.get(key);if(cached!==undefined)return cached;
  const mid=Date.parse(day+"T00:00:00Z");let lo=mid-48*3600000,hi=mid+48*3600000;
  while(hi-lo>1) {const m=Math.floor((lo+hi)/2);if(parts(m,zone).date<day)lo=m;else hi=m;}
  if(starts.size>20000)starts.clear();starts.set(key,hi);return hi;
}
function timestamp(text:string|undefined) {
  if(!text || !/(?:Z|[+-]\d\d:\d\d)$/.test(text) || !Number.isFinite(Date.parse(text))) throw new CalendarError("invalid");
  return Date.parse(text);
}
function base(id:string,title:string,category:string,date:string,time:string|null,estimate:number,data:unknown):Item {
  return {id,kind:"event",title,description:"",status:"backlog",priority:2,estimate,weight:1,date,time,due:null,projectId:null,
    category,tags:"",duration:0,distance:null,data:JSON.stringify({externalCalendar:data}),createdAt:"1970-01-01T00:00:00.000Z",completedAt:null,deletedAt:null};
}
function timed(id:string,title:string,start:number,end:number,zone:string,category:string,metadata:Record<string,unknown>) {
  if(end<=start) throw new CalendarError("invalid");
  const result:Item[]=[];
  for(let cursor=start,guard=0;cursor<end;guard++) {
    if(guard>400)throw new CalendarError("invalid");
    const a=parts(cursor,zone),boundary=dayStart(nextDay(a.date),zone),stop=Math.min(end,boundary);
    if(stop<=cursor)throw new CalendarError("invalid");
    let lower=a.minute,upper=stop===boundary?1440:parts(stop,zone).minute+(stop%60000?1:0);
    // Cover repeated wall-clock minutes conservatively on DST fall-back days.
    for(let sample=cursor;Math.abs((stop-cursor)/60000-(upper-lower))>2&&sample<stop;sample+=60000) {
      const m=parts(sample,zone).minute;lower=Math.min(lower,m);upper=Math.max(upper,m+1);
    }
    upper=Math.max(upper,lower+1);
    const item=base(stableCalendarId(`${id}/${a.date}`),title,category,a.date,`${String(Math.floor(lower/60)).padStart(2,"0")}:${String(lower%60).padStart(2,"0")}`,upper-lower,
      {...metadata,segmentStart:new Date(cursor).toISOString(),segmentEnd:new Date(stop).toISOString(),displayZone:zone});
    result.push(item);cursor=stop;
  }
  return result;
}
export function projectCalendarEvents(rows:{localId:string;event:GoogleEvent}[],calendar:CalendarChoice,zone:string,before:number,after:number):Item[] {
  const result:Item[]=[],days=new Map<string,{first:number;last:number;before:boolean;after:boolean}>();
  for(const {localId,event:e} of rows) {
    if(e.status==="cancelled")continue;
    const metadata={provider:"google-calendar",readOnly:true,calendarId:calendar.id,calendarName:calendar.summary,eventId:e.id,
      recurringEventId:e.recurringEventId??null,originalStartTime:e.originalStartTime??null,recurrence:e.recurrence??null,
      location:e.location??null,sourceSummary:e.summary??null,sourceTimeZone:e.start?.timeZone??calendar.timeZone,sourceStart:e.start??null,sourceEnd:e.end??null,virtual:false};
    let items:Item[];
    if(e.start?.date && e.end?.date) {
      items=[];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(e.start.date)||!/^\d{4}-\d{2}-\d{2}$/.test(e.end.date)||e.end.date<=e.start.date)throw new CalendarError("invalid");
      let guard=0;
      for(let d=e.start.date;d<e.end.date;d=nextDay(d)) {
        if(guard++>400)throw new CalendarError("invalid");
        items.push(base(stableCalendarId(`${localId}/${d}`),e.summary??"(без названия)","university",d,null,1440,{...metadata,allDay:true,displayZone:zone}));
      }
    } else {
      const start=timestamp(e.start?.dateTime),end=timestamp(e.end?.dateTime);
      items=timed(localId,e.summary??"(без названия)",start,end,zone,"university",metadata);
      for(const i of items) {
        const x=JSON.parse(i.data).externalCalendar;
        const a=Date.parse(x.segmentStart),b=Date.parse(x.segmentEnd),d=i.date!;
        const old=days.get(d);days.set(d,{first:Math.min(old?.first??a,a),last:Math.max(old?.last??b,b),before:old&&old.first<a?old.before:a===start&&(old?.first===a?old.before:true),after:old&&old.last>b?old.after:b===end&&(old?.last===b?old.after:true)});
      }
    }
    for(const i of items)i.description=e.description??"";
    result.push(...items);
  }
  for(const [date,range] of days) {
    const meta={provider:"google-calendar",readOnly:true,virtual:true,calendarId:calendar.id,calendarName:calendar.summary,eventId:null,day:date};
    if(before>0&&range.before)result.push(...timed(`commute/${calendar.id}/${date}/before`,"Дорога в университет",range.first-before*60000,range.first,zone,"commute",{...meta,direction:"before"}));
    if(after>0&&range.after)result.push(...timed(`commute/${calendar.id}/${date}/after`,"Дорога из университета",range.last,range.last+after*60000,zone,"commute",{...meta,direction:"after"}));
  }
  return result;
}
