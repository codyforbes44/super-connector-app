import type { SupabaseClient } from "@supabase/supabase-js";
import { carrierMediaPath } from "./communications";
import { twilioRequest } from "./twilio.server";

export async function messageAttachments(supabase: SupabaseClient, id: string) {
  const { data: message, error } = await supabase.from("messages").select("id,sid,media,workspace_id").eq("id",id).maybeSingle();
  if (error) throw error;
  if (!message) throw new Error("Message not found or access denied.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let media = Array.isArray(message.media) ? message.media as Array<{url:string;contentType?:string}> : [];
  if (!media.length && /^(SM|MM)[a-f0-9]{32}$/.test(message.sid ?? "")) {
    const result = await twilioRequest<{media_list:Array<{uri:string;content_type:string}>}>({path:`/Messages/${message.sid}/Media.json`});
    media = result.media_list.map((item)=>({url:`https://api.twilio.com${item.uri.replace(/\.json$/,"")}`,contentType:item.content_type}));
    if (media.length) {
      const { error: saveError } = await supabaseAdmin.from("messages").update({media}).eq("id",id);
      if (saveError) throw saveError;
    }
  }
  const results = [];
  for (const [index,item] of media.entries()) {
    const path=carrierMediaPath(item.url);
    if (!path) { results.push(item); continue; }
    const key=`${message.workspace_id}/${id}/${index}`;
    const bytes=await twilioRequest<Uint8Array>({path,binary:true});
    const { error: uploadError }=await supabaseAdmin.storage.from("mms-media").upload(key,bytes,{contentType:item.contentType||"application/octet-stream",upsert:true});
    if(uploadError) throw uploadError;
    const {data:signed,error:signError}=await supabaseAdmin.storage.from("mms-media").createSignedUrl(key,900);
    if(signError) throw signError;
    results.push({url:signed.signedUrl,contentType:item.contentType});
  }
  return results;
}