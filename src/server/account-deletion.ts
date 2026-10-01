import "../lib/server-only.ts";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../integrations/supabase/client.server.ts";

export const deletionReceiptHash = (receipt: string) => createHash("sha256").update(receipt).digest("hex");
export async function deletionRpc(name: string, args: Record<string,string>) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Deletion service unavailable");
  const {data,error} = await (admin as unknown as {rpc:(name:string,args:Record<string,string>)=>Promise<{data:unknown,error:unknown}>}).rpc(name,args);
  if (error) throw new Error("Deletion service unavailable");
  return data;
}

// A receipt confers only continuation of an already committed deletion; it
// never authenticates a session or permits a caller to select an account.
export async function continueAccountDeletion(receipt: string): Promise<"complete"|"pending"|"invalid"> {
  if (!/^[a-f0-9]{64}$/.test(receipt)) return "invalid";
  const job = await deletionRpc("ghostwriter_delete_job",{p_receipt_hash:deletionReceiptHash(receipt)}) as {accountId?:unknown,completed?:unknown}|null;
  if (!job || typeof job.accountId !== "string" || !/^[a-f0-9-]{36}$/i.test(job.accountId)) return "invalid";
  if (job.completed === true) return "complete";
  const account = job.accountId;
  const admin = getSupabaseAdmin()!;
  const objects = await deletionRpc("ghostwriter_delete_objects",{p_account_id:account});
  if (!Array.isArray(objects) || objects.length>100) throw new Error("Deletion inventory unavailable");
  // Bound each continuation to one Storage request; the durable receipt
  // resumes remaining objects without a long-running cleanup request.
  for (const object of objects.slice(0,1)) {
    if (!object || typeof object.bucket!=="string" || typeof object.name!=="string") throw new Error("Deletion inventory unavailable");
    const {error} = await admin.storage.from(object.bucket).remove([object.name]);
    if (error) return "pending";
  }
  if (objects.length > 1) return "pending";
  const {error} = await admin.auth.admin.deleteUser(account);
  // A lost response after Auth committed is recovered by the authoritative
  // completion RPC; no re-creation or refund is ever attempted.
  const complete = await deletionRpc("ghostwriter_delete_complete",{p_account_id:account});
  if (complete === true) return "complete";
  if (error) return "pending";
  return "pending";
}
