import type { SupabaseClient } from "@supabase/supabase-js";

type SB = SupabaseClient;

/** Per-line recording flag. Missing column or row means off. */
export async function lineRecordsCalls(admin: SB, phoneNumber: string): Promise<boolean> {
  const { data, error } = await admin
    .from("phone_numbers")
    .select("record_calls")
    .eq("phone_number", phoneNumber)
    .maybeSingle();
  if (error || !data) return false;
  return Boolean(data["record_calls"]);
}

export async function setLineRecording(
  admin: SB,
  input: { sid: string; recordCalls: boolean },
): Promise<void> {
  const { error } = await admin
    .from("phone_numbers")
    .update({ record_calls: input.recordCalls })
    .eq("sid", input.sid);
  if (error) throw new Error(error.message);
}
