"use client";

import { useState } from "react";

export default function AccountPage() {
  const [confirmation,setConfirmation]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [state,setState]=useState("");
  async function remove() {
    if (busy || confirmation!=="DELETE MY ACCOUNT") return;
    setBusy(true);
    try {
      const csrf=document.cookie.split("; ").find(c=>c.startsWith("gw_csrf="))?.slice(8);
      if (!csrf) throw new Error("security unavailable");
      const response=await fetch("/api/ghostwriter/account/delete",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json","x-ghostwriter-csrf":decodeURIComponent(csrf)},
        body:JSON.stringify({confirmation}),signal:AbortSignal.timeout(25000),
      });
      const data=await response.json();
      setMessage(typeof data.message==="string"?data.message:"Cleanup could not be confirmed.");
      if (data.state==="pending" || data.state==="complete") {
        setState(data.state);
        const channel=new BroadcastChannel("ghostwriter-identity");
        channel.postMessage("deleted");channel.close();
      }
    } catch {
      setMessage("Cleanup could not be confirmed. Try again. If the response was lost after access was revoked, owner-assisted recovery may be needed; no allowance is reset.");
    } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-2xl px-6 py-16 text-[#eeeae3]">
    <a href="/second-voice" className="underline underline-offset-4">Back to Second Voice</a>
    <h1 className="mt-10 text-3xl">Account &amp; deletion</h1>
    <p className="mt-6">Deletion revokes access, removes your account and clears private stored rewrites. Minimal trial and recovery records follow the seven-day content and 90-day recovery policy in <a href="/second-voice/privacy" className="underline">Privacy &amp; contact</a>; they are not anonymous. Unresolved charges or incomplete cleanup need reconciliation. Previously copied text cannot be recalled.</p>
    <p className="mt-4">Sign out and sign in again before deleting. Confirmation must follow a fresh sign-in within ten minutes. This does not use a rewrite.</p>
    {state!=="complete" && <form className="mt-8" onSubmit={event=>{event.preventDefault();void remove();}}>
      <label htmlFor="confirmation">Type DELETE MY ACCOUNT to confirm</label>
      <input id="confirmation" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="mt-3 block min-h-12 w-full rounded-lg border border-white/25 bg-transparent px-3 focus-visible:outline-2 focus-visible:outline-[#9bcaff]" />
      <button disabled={busy || confirmation!=="DELETE MY ACCOUNT"} className="mt-5 min-h-12 rounded-lg border border-[#e6aaa0] px-5 disabled:opacity-50" type="submit">{busy?"Confirming…":state==="pending"?"Retry cleanup":"Delete my account"}</button>
    </form>}
    <p role="status" className="mt-6">{message}</p>
  </main>;
}
