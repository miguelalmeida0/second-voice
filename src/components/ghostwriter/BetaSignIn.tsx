"use client";
import { useEffect, useState } from "react";
import { issueGhostwriterChallenge, readGhostwriterCsrfToken, refreshGhostwriterShieldSession } from "@/lib/ghostwriter-client-guard";
export function BetaSignIn({emailEnabled=false,githubEnabled=false,portfolio=false}:{emailEnabled?:boolean;githubEnabled?:boolean;portfolio?:boolean}) {
 const [email,setEmail]=useState("");
 const [token,setToken]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [allowance,setAllowance]=useState<{remaining:number;todayRemaining?:number;available:boolean}|null>(null);
 useEffect(()=>{
  const channel=new BroadcastChannel("ghostwriter-identity");
  channel.onmessage=()=>window.location.reload();
  if(new URLSearchParams(window.location.search).get("auth")==="complete"){
   window.history.replaceState(null,"","/second-voice");
   channel.postMessage("changed");
  }
  const restored=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload();};
  window.addEventListener("pageshow",restored);
  return ()=>{channel.close();window.removeEventListener("pageshow",restored);};
 },[]);
 useEffect(()=>{
  let active=true;
  const update=async()=>{
   const csrf=readGhostwriterCsrfToken();if(!csrf)return;
   try{
    const response=await fetch("/api/ghostwriter/auth",{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-ghostwriter-csrf":csrf},body:JSON.stringify({action:"status"})});
    const data=await response.json();if(active)setAllowance(response.ok?data.allowance??null:null);
   }catch{if(active)setAllowance(null);}
  };
  void update();window.addEventListener("ghostwriter-allowance-changed",update);
  return ()=>{active=false;window.removeEventListener("ghostwriter-allowance-changed",update);};
 },[]);
 async function act(action:string){
  setBusy(true);
  try{
   const csrf=readGhostwriterCsrfToken() || await refreshGhostwriterShieldSession();
   if(!csrf) throw new Error("Refresh the page to sign in.");
   const challenge=action==="logout" ? {} : await issueGhostwriterChallenge(csrf);
   const response=await fetch("/api/ghostwriter/auth",{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-ghostwriter-csrf":csrf},body:JSON.stringify({action,...(action==="send-code"||action==="verify"?{email}:{}),...(action==="verify"?{token}:{}),...challenge})});
   const data=await response.json();
   if(response.ok && action==="github" && typeof data.url==="string"){window.location.assign(data.url);return;}
   setToken("");
   setMessage(data.message ?? "Authentication unavailable.");
   if((response.ok && ["verify","refresh","logout"].includes(action)) || (action==="logout" && response.status===401)){
    // No tokens or text cross tabs; discard all component-held private output.
    const channel=new BroadcastChannel("ghostwriter-identity");
    channel.postMessage("changed");
    channel.close();
    window.location.reload();
   }
  }catch{setMessage("Authentication unavailable. Refresh and try again.");}
  finally{setBusy(false);}
 }
 return <details className="mx-auto w-full max-w-3xl px-6 py-4 text-sm">
  <summary>{portfolio?"Free portfolio trial · Sign in":"Invited beta access"}</summary>
  {githubEnabled && <button type="button" className="mt-4 rounded border border-current px-4 py-2" disabled={busy} onClick={()=>void act("github")}>Continue with GitHub</button>}
  {!githubEnabled && !emailEnabled && <p className="mt-3">Visitor sign-in is not configured yet. Live rewriting is unavailable.</p>}
  <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void act("verify");}}>
   {emailEnabled && <>
   <label>Email<input className="block rounded border border-current bg-transparent p-2" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
   <button type="button" disabled={busy||!email} onClick={()=>void act("send-code")}>Send code</button>
   <label>Email code<input className="block rounded border border-current bg-transparent p-2" inputMode="numeric" autoComplete="one-time-code" value={token} onChange={e=>setToken(e.target.value)} maxLength={8}/></label>
   <button disabled={busy||!token}>Sign in</button>
   </>}
   <button type="button" disabled={busy} onClick={()=>void act("refresh")}>Refresh session</button>
   <button type="button" disabled={busy} onClick={()=>void act("logout")}>Sign out</button>
  </form>
  {portfolio && allowance && <p className="mt-3">{allowance.remaining} of 10 lifetime starts remaining{typeof allowance.todayRemaining==="number"?` · ${allowance.todayRemaining} available in this rolling day`:""}.{!allowance.available?" Rewriting is currently paused.":" Shared Free-tier limits may temporarily pause access."}</p>}
  <p role="status" className="mt-3">{message}</p>
 </details>;
}
