import http from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { OAuthClient, Tokens } from "./types.ts";
import { CalendarError, READ_SCOPES } from "./types.ts";

export const AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_URL="https://oauth2.googleapis.com/token";
export function parseDesktopClient(text:string):OAuthClient {
  try {
    if(Buffer.byteLength(text)>64*1024)throw Error();
    const c=JSON.parse(text).installed;
    if(!c || typeof c.client_id!=="string" || !/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(c.client_id))throw Error();
    if(c.client_secret!==undefined && (typeof c.client_secret!=="string" || c.client_secret.length>1024))throw Error();
    return {clientId:c.client_id,...(c.client_secret?{clientSecret:c.client_secret}:{})};
  } catch {throw new CalendarError("client");}
}
export async function tokenRequest(client:OAuthClient,fields:Record<string,string>,fetcher:typeof fetch=fetch):Promise<Tokens> {
  let response:Response;
  try {
    response=await fetcher(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:client.clientId,...(client.clientSecret?{client_secret:client.clientSecret}:{}),...fields}),signal:AbortSignal.timeout(15000),redirect:"error"});
  } catch {throw new CalendarError("network");}
  if(!response.ok)throw new CalendarError(response.status===400||response.status===401?"auth":response.status===429?"quota":"server",response.status);
  let body:any;try{const text=await response.text();if(text.length>128*1024)throw Error();body=JSON.parse(text);}catch{throw new CalendarError("invalid");}
  if(typeof body.access_token!=="string"||!body.access_token||body.access_token.length>16384||!Number.isFinite(body.expires_in)||body.expires_in<=0)throw new CalendarError("invalid");
  if(body.refresh_token!==undefined&&(typeof body.refresh_token!=="string"||body.refresh_token.length>16384))throw new CalendarError("invalid");
  if(body.scope && !READ_SCOPES.every(s=>String(body.scope).split(" ").includes(s)))throw new CalendarError("denied");
  return {accessToken:body.access_token,refreshToken:body.refresh_token,expiresAt:Date.now()+body.expires_in*1000};
}
export class DesktopOAuth {
  private cancelPending:(()=>void)|null=null;
  constructor(private openBrowser:(url:string)=>Promise<unknown>,private fetcher:typeof fetch=fetch) {}
  cancel() {this.cancelPending?.();}
  async authorize(client:OAuthClient):Promise<Tokens> {
    this.cancel();
    const state=randomBytes(32).toString("base64url"),verifier=randomBytes(48).toString("base64url");
    let redirect="";
    const code=await new Promise<string>((resolve,reject)=>{
      let finished=false;
      const server=http.createServer((request,response)=>{
        response.setHeader("Cache-Control","no-store");response.setHeader("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'");
        if(request.method!=="GET" || request.headers.host!==new URL(redirect).host){response.writeHead(400);response.end();return;}
        const url=new URL(request.url??"/",redirect);
        if(url.pathname!=="/oauth2/callback"){response.writeHead(404);response.end();return;}
        const got=Buffer.from(url.searchParams.get("state")??""),expected=Buffer.from(state);
        if(got.length!==expected.length||!timingSafeEqual(got,expected)){response.writeHead(400);response.end("Invalid state");return;}
        const value=url.searchParams.get("code");
        if(url.searchParams.has("error")||!value||value.length>8192){response.end("Connection cancelled. Return to FOCUS OS PRO.");done(new CalendarError("cancelled"));return;}
        response.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});
        response.end("<!doctype html><title>FOCUS OS PRO</title><p>Подключение подтверждено. Закройте вкладку и вернитесь в FOCUS OS PRO.</p>",()=>done(null,value));
      });
      const timer=setTimeout(()=>done(new CalendarError("cancelled")),180000);
      const done=(error:Error|null,value?:string)=>{
        if(finished)return;finished=true;clearTimeout(timer);this.cancelPending=null;server.close();server.closeAllConnections();
        if(error) reject(error); else resolve(value!);
      };
      this.cancelPending=()=>done(new CalendarError("cancelled"));
      server.on("error",()=>done(new CalendarError("network")));
      server.listen(0,"127.0.0.1",()=>{
        const address=server.address();if(!address||typeof address==="string"){done(new CalendarError("network"));return;}
        redirect=`http://127.0.0.1:${address.port}/oauth2/callback`;
        const url=new URL(AUTH_URL);
        for(const [k,v] of Object.entries({client_id:client.clientId,redirect_uri:redirect,response_type:"code",scope:READ_SCOPES.join(" "),state,
          code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256",access_type:"offline",prompt:"consent select_account",include_granted_scopes:"false"}))url.searchParams.set(k,v);
        this.openBrowser(url.href).catch(()=>done(new CalendarError("network")));
      });
    });
    return tokenRequest(client,{code,code_verifier:verifier,redirect_uri:redirect,grant_type:"authorization_code"},this.fetcher);
  }
}
