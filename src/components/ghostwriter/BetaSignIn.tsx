"use client";
import { useEffect, useRef, useState } from "react";
import { usePortfolioAccess } from "@/components/ghostwriter/PortfolioAccess";
import { parsePortfolioAllowance, type PortfolioAllowance } from "@/lib/portfolio-access";
import { issueGhostwriterChallenge, readGhostwriterCsrfToken, refreshGhostwriterShieldSession } from "@/lib/ghostwriter-client-guard";
export function BetaSignIn({emailEnabled=false,githubEnabled=false,portfolio=false}:{emailEnabled?:boolean;githubEnabled?:boolean;portfolio?:boolean}) {
 const [email,setEmail]=useState("");
 const [token,setToken]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [allowance,setAllowance]=useState<PortfolioAllowance|null>(null);
 const access=usePortfolioAccess();
 const setSession=access?.setSession;
 const detailsRef=useRef<HTMLDetailsElement>(null);
 const githubRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const open=()=>{
   if(!detailsRef.current)return;
   detailsRef.current.open=true;
   detailsRef.current.scrollIntoView({block:"center",behavior:"auto"});
   githubRef.current?.focus({preventScroll:true});
  };
  window.addEventListener("ghostwriter-sign-in",open);
  return ()=>window.removeEventListener("ghostwriter-sign-in",open);
 },[]);
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
  let sequence=0;
  let pending:AbortController|null=null;
  const update=async()=>{
   const current=++sequence;
   pending?.abort();
   const controller=new AbortController();pending=controller;
   const timeout=window.setTimeout(()=>controller.abort(),12000);
   try{
    const csrf=readGhostwriterCsrfToken() || await refreshGhostwriterShieldSession({signal:controller.signal});
    if(!csrf)throw new Error("Session unavailable");
    const response=await fetch("/api/ghostwriter/auth",{method:"POST",cache:"no-store",signal:controller.signal,headers:{"content-type":"application/json","x-ghostwriter-csrf":csrf},body:JSON.stringify({action:"status"})});
    const data=await response.json();
    if(active && current===sequence){
     const next=response.ok?parsePortfolioAllowance(data.allowance):null;
     setAllowance(next);
     setSession?.(response.ok?{status:"authenticated",allowance:next}:{status:response.status===401?"anonymous":"unavailable"});
    }
   }catch{if(active && current===sequence){setAllowance(null);setSession?.({status:"unavailable"});}}
   finally{window.clearTimeout(timeout);}
  };
  void update();window.addEventListener("ghostwriter-allowance-changed",update);
  window.addEventListener("focus",update);
  return ()=>{active=false;pending?.abort();window.removeEventListener("ghostwriter-allowance-changed",update);window.removeEventListener("focus",update);};
 },[setSession]);
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
 return <details ref={detailsRef} className="mx-auto w-full max-w-3xl px-6 py-4 text-sm">
  <summary>{portfolio?(access?.session.status==="authenticated"?"Free portfolio trial · Account":"Free portfolio trial · Sign in"):"Invited beta access"}</summary>
  {githubEnabled && access?.session.status!=="authenticated" && <button ref={githubRef} type="button" className="mt-4 rounded border border-current px-4 py-2" disabled={busy} onClick={()=>void act("github")}>Sign in with GitHub</button>}
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
  {portfolio && allowance && <p className="mt-3">{allowance.remaining} trial rewrites remaining.{allowance.remaining===0?" Your portfolio trial has reached its limit.":!allowance.available || allowance.todayRemaining===0?" AI demo is temporarily unavailable.":" Shared Free-tier availability applies."}</p>}
  <p role="status" className="mt-3">{message}</p>
 </details>;
}
