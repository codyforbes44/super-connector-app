import type { SupabaseClient } from "@supabase/supabase-js";
import { forwardedCallParent, type CarrierCall } from "./provider-identity";
import { twilioRequest } from "./twilio.server";

export async function resolveCallIdentity(
  admin: SupabaseClient,
  sid: string,
  providerCall?: CarrierCall,
  relatedCalls?: CarrierCall[],
): Promise<string> {
  const { data: alias, error } = await admin.from("call_provider_aliases").select("canonical_sid").eq("alias_sid", sid).maybeSingle();
  if (error) throw error;
  if (alias) return String(alias.canonical_sid);
  const call = providerCall ?? await twilioRequest<CarrierCall>({ path: `/Calls/${encodeURIComponent(sid)}.json` });
  if (call.direction !== "inbound" || call.forwarded_from !== call.to || [call.from, call.to].includes("+12149786445")) return sid;
  const related = relatedCalls ?? (await twilioRequest<{ calls: CarrierCall[] }>({ path: "/Calls.json", params: { From: call.from, To: call.to, PageSize: 100 } })).calls;
  const parentSid = forwardedCallParent(call, related);
  if (!parentSid) return sid;
  const { data: parent, error: parentError } = await admin.from("calls").select("workspace_id,from_number,to_number").eq("sid", parentSid).maybeSingle();
  if (parentError) throw parentError;
  if (!parent?.workspace_id || parent.from_number !== call.from || parent.to_number !== call.to) return sid;
  const { error: aliasError } = await admin.from("call_provider_aliases").upsert({ alias_sid: sid, canonical_sid: parentSid, workspace_id: parent.workspace_id, evidence: { source: "carrier-forwarded-leg", provider_sid: sid } }, { onConflict: "alias_sid", ignoreDuplicates: true });
  if (aliasError) throw aliasError;
  return parentSid;
}

/** Known aliases only: status/recording callbacks must not fetch or overwrite another leg's duration. */
export async function knownCallIdentity(admin: SupabaseClient, sid: string): Promise<string> {
  const { data, error } = await admin.from("call_provider_aliases").select("canonical_sid").eq("alias_sid", sid).maybeSingle();
  if (error) throw error;
  return data ? String(data.canonical_sid) : sid;
}