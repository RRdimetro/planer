import type { CalendarAction, CalendarChoice, CalendarStatus, SecretVault, Tokens } from "./types.ts";
import { CALENDAR_NAME, CalendarError, calendarError, messages } from "./types.ts";
import { tokenRequest, type DesktopOAuth } from "./oauth.ts";
import { CalendarRepository } from "./repository.ts";
import { projectCalendarEvents } from "./projection.ts";
import { validZone, validateGoogleEvent as validateEvent } from "./validation.ts";

const API="https://www.googleapis.com/calendar/v3";
export class GoogleCalendarService {
  private epoch=0;
  private choices:CalendarChoice[]=[];
  private pending:Promise<void>|null=null;
  private refreshing:Promise<Tokens>|null=null;
  private abort:AbortController|null=null;
  private lastAttempt=0;
  private stopped=false;
  private projectionCache:{key:string;items:ReturnType<typeof projectCalendarEvents>}|null=null;
  constructor(public repo:CalendarRepository,private vault:SecretVault,private oauth:Pick<DesktopOAuth,"authorize"|"cancel">,
    private fetcher:typeof fetch=fetch,private now=()=>Date.now(),private sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))) {}
  status():CalendarStatus {
    const cfg=this.repo.settings(),source=cfg.calendar?this.repo.source(cfg.calendar.id):{};
    let configured=false,authorized=false,error=cfg.error;
    try {const secret=this.vault.read();configured=Boolean(secret.client);authorized=Boolean(secret.tokens?.refreshToken);}
    catch {error=messages.secure;}
    return {configured,connected:cfg.enabled&&authorized&&error!==messages.auth,syncing:Boolean(this.pending),calendar:cfg.calendar,
      choices:this.choices,lastSuccess:source.last_success??null,error,cachedEvents:cfg.calendar?this.repo.occurrences(cfg.calendar.id).length:0,
      commuteBefore:cfg.commuteBefore,commuteAfter:cfg.commuteAfter,intervalMinutes:cfg.intervalMinutes,windowStart:source.window_start??null,windowEnd:source.window_end??null};
  }
  projected(zone:string) {
    const cfg=this.repo.settings();if(!cfg.calendar)return [];
    const key=JSON.stringify([cfg.calendar,this.repo.source(cfg.calendar.id).last_success,zone,cfg.commuteBefore,cfg.commuteAfter]);
    if(this.projectionCache?.key===key)return this.projectionCache.items;
    const items=projectCalendarEvents(this.repo.occurrences(cfg.calendar.id),cfg.calendar,zone,cfg.commuteBefore,cfg.commuteAfter);
    this.projectionCache={key,items};return items;
  }
  async connect() {
    const epoch=++this.epoch;this.abort?.abort();this.repo.disconnect();this.choices=[];
    try {
      const secret=this.vault.read();if(!secret.client)throw new CalendarError("client");
      const tokens=await this.oauth.authorize(secret.client);
      if(epoch!==this.epoch||this.stopped)throw new CalendarError("changed");
      if(!tokens.refreshToken)throw new CalendarError("auth");
      this.vault.write({client:secret.client,tokens});
      const matches=await this.findCalendars();
      if(epoch!==this.epoch)throw new CalendarError("changed");
      this.choices=matches;
      if(!matches.length)throw new CalendarError("missing");
      if(matches.length===1)await this.choose(matches[0].id);
    } catch(error) {const safe=calendarError(error);if(epoch===this.epoch&&!this.stopped)this.repo.error(this.repo.settings().generation,safe.message);throw safe;}
  }
  async choose(id:string) {
    const calendar=this.choices.find(c=>c.id===id);if(!calendar)throw new CalendarError("invalid");
    this.epoch++;this.abort?.abort();this.repo.select(calendar);this.choices=[];
    if(this.pending) {try{await this.pending;}catch{/* Expected cancellation or encrypted-temp cleanup; no raw errors are logged. */} }
    await this.sync();
  }
  disconnect() {this.epoch++;this.oauth.cancel();this.abort?.abort();this.repo.disconnect();this.choices=[];this.vault.clearTokens();}
  setClient(client: import("./types.ts").OAuthClient) {this.epoch++;this.oauth.cancel();this.abort?.abort();this.repo.disconnect();this.choices=[];this.vault.write({client});}
  close() {this.stopped=true;this.epoch++;this.oauth.cancel();this.abort?.abort();}
  configure(action:Extract<CalendarAction,{action:"settings"}>) {
    this.repo.configure(action.commuteBefore,action.commuteAfter,action.intervalMinutes);
  }
  async tick() {
    const cfg=this.repo.settings();if(this.stopped||!cfg.enabled||this.pending)return;
    if(this.now()-this.lastAttempt<cfg.intervalMinutes*60000)return;
    try{await this.sync();}catch{/* A fixed, sanitized error is already available in the settings UI. */}
  }
  sync():Promise<void> {
    if(this.pending)return this.pending;
    const cfg=this.repo.settings();if(this.stopped||!cfg.enabled||!cfg.calendar)return Promise.resolve();
    this.lastAttempt=this.now();this.abort=new AbortController();
    const epoch=this.epoch,signal=this.abort.signal;
    const job=(async()=>{
      try {
        const source=this.repo.source(cfg.calendar!.id),params={singleEvents:"false",showDeleted:"true",maxResults:"2500"};
        let full=!source.sync_token,raw;
        try {raw=await this.pages(`/calendars/${encodeURIComponent(cfg.calendar!.id)}/events`,{...params,...(full?{}:{syncToken:source.sync_token})},signal);}
        catch(error) {
          if(!(error instanceof CalendarError)||error.status!==410)throw error;
          full=true;raw=await this.pages(`/calendars/${encodeURIComponent(cfg.calendar!.id)}/events`,params,signal);
        }
        if(typeof raw.syncToken!=="string"||!raw.syncToken)throw new CalendarError("invalid");
        const start=new Date(this.now()-90*86400000).toISOString(),end=new Date(this.now()+400*86400000).toISOString();
        const expanded=await this.pages(`/calendars/${encodeURIComponent(cfg.calendar!.id)}/events`,{singleEvents:"true",showDeleted:"true",maxResults:"2500",timeMin:start,timeMax:end},signal);
        const events=raw.items.map(validateEvent),occurrences=expanded.items.map(validateEvent);
        // Validate the complete expanded graph before the cache transaction.
        projectCalendarEvents(occurrences.filter(e=>e.status!=="cancelled").map(e=>({localId:e.id,event:e})),cfg.calendar!,cfg.calendar!.timeZone,0,0);
        if(epoch!==this.epoch||this.stopped)throw new CalendarError("changed");
        this.repo.commit({generation:cfg.generation,calendarId:cfg.calendar!.id,full,events,occurrences,syncToken:raw.syncToken,windowStart:start,windowEnd:end,now:new Date(this.now()).toISOString()});
      } catch(error) {const safe=calendarError(error);if(epoch===this.epoch&&!this.stopped)this.repo.error(cfg.generation,safe.message);throw safe;}
    })();
    this.pending=job;
    void job.finally(()=>{if(this.pending===job)this.pending=null;}).catch(()=>{});
    return job;
  }
  private async access(force=false):Promise<string> {
    const secret=this.vault.read();if(!secret.client||!secret.tokens?.refreshToken)throw new CalendarError("auth");
    if(!force&&secret.tokens.expiresAt>this.now()+60000)return secret.tokens.accessToken;
    if(!this.refreshing) {
      const epoch=this.epoch;
      this.refreshing=tokenRequest(secret.client,{grant_type:"refresh_token",refresh_token:secret.tokens.refreshToken},this.fetcher)
        .then(tokens=>{if(epoch!==this.epoch||this.stopped)throw new CalendarError("changed");const result={...tokens,refreshToken:tokens.refreshToken??secret.tokens!.refreshToken};this.vault.write({client:secret.client,tokens:result});return result;});
      const promise=this.refreshing;void promise.finally(()=>{if(this.refreshing===promise)this.refreshing=null;}).catch(()=>{});
    }
    return (await this.refreshing).accessToken;
  }
  private async request(route:string,params:Record<string,string>,signal?:AbortSignal) {
    const url=new URL(API+route);for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
    let refreshed=false;
    for(let attempt=0;attempt<4;attempt++) {
      if(signal?.aborted)throw new CalendarError("changed");
      let response:Response;
      const token=await this.access();
      try {response=await this.fetcher(url,{method:"GET",headers:{Authorization:`Bearer ${token}`},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),redirect:"error"});}
      catch{throw new CalendarError(signal?.aborted?"changed":"network");}
      if(response.status===401&&!refreshed){await response.body?.cancel();await this.access(true);refreshed=true;continue;}
      if(response.status===403) {
        let quota=false;
        try {const body=await response.text();if(body.length<=65536){const data=JSON.parse(body);quota=(data.error?.errors??[]).some((x:any)=>["rateLimitExceeded","userRateLimitExceeded","quotaExceeded"].includes(x.reason));}}catch{/* Expected cancellation or encrypted-temp cleanup; no raw errors are logged. */}
        if(quota&&attempt<3){await this.sleep(500*2**attempt);continue;}
        throw new CalendarError(quota?"quota":"denied",403);
      }
      if((response.status===429||response.status>=500)&&attempt<3) {
        const retry=Number(response.headers.get("Retry-After"));await response.body?.cancel();
        await this.sleep(Math.min(60000,Number.isFinite(retry)&&retry>0?retry*1000:500*2**attempt+Math.floor(Math.random()*200)));continue;
      }
      if(!response.ok){await response.body?.cancel();throw new CalendarError(response.status===401?"auth":response.status===403||response.status===404?"denied":response.status===410?"expired":response.status===429?"quota":"server",response.status);}
      try{const text=await response.text();if(text.length>16*1024*1024)throw Error();return JSON.parse(text);}catch{throw new CalendarError("invalid");}
    }
    throw new CalendarError("server");
  }
  private async pages(route:string,params:Record<string,string>,signal?:AbortSignal) {
    const items:any[]=[],tokens=new Set<string>();let pageToken:string|undefined, syncToken:string|undefined;
    for(let page=0;page<1000;page++) {
      const data=await this.request(route,{...params,...(pageToken?{pageToken}:{})},signal);
      const batch=data.items??[];
      if(!Array.isArray(batch)||items.length+batch.length>250000)throw new CalendarError("invalid");
      items.push(...batch);
      if(!data.nextPageToken){syncToken=data.nextSyncToken;const unique=new Map<string,any>();for(const e of items){if(typeof e.id!=="string")throw new CalendarError("invalid");const old=unique.get(e.id);if(!old||String(e.updated??"")>=String(old.updated??""))unique.set(e.id,e);}return{items:[...unique.values()],syncToken};}
      if(typeof data.nextPageToken!=="string"||tokens.has(data.nextPageToken))throw new CalendarError("invalid");
      tokens.add(data.nextPageToken);pageToken=data.nextPageToken;
    }
    throw new CalendarError("invalid");
  }
  private async findCalendars():Promise<CalendarChoice[]> {
    const result=await this.pages("/users/me/calendarList",{maxResults:"250",showHidden:"true",minAccessRole:"reader"});
    return result.items.filter(c=>!c.deleted&&(c.summaryOverride??c.summary)===CALENDAR_NAME).map(c=>{
      if(!validZone(c.timeZone))throw new CalendarError("invalid");
      return{id:c.id,summary:CALENDAR_NAME,timeZone:c.timeZone};
    });
  }
}
