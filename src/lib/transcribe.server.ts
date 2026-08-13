/**
 * Speech-to-text for Twilio recordings through the Lovable AI gateway.
 * Server-only.
 */

const TRANSCRIBE_URL = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const STT_MODEL = "openai/gpt-4o-transcribe";

export class TranscriptionUnavailable extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Download a Twilio recording as audio bytes (media URLs need account auth). */
export async function fetchRecording(url: string): Promise<Blob> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const media = url.endsWith(".mp3") || url.endsWith(".wav") ? url : `${url}.mp3`;
  const headers: Record<string, string> = {};
  if (sid && token) headers["Authorization"] = `Basic ${btoa(`${sid}:${token}`)}`;

  const res = await fetch(media, { headers });
  if (!res.ok) {
    throw new TranscriptionUnavailable(
      `Could not download the recording [${res.status}].`,
      res.status,
    );
  }
  return res.blob();
}

/** Transcribe audio to plain text. Throws TranscriptionUnavailable on failure. */
export async function transcribeAudio(audio: Blob, filename = "call.mp3"): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new TranscriptionUnavailable("Transcription is not configured.", 412);

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", STT_MODEL);
  form.append("response_format", "json");

  const res = await fetch(TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Transcription failed [${res.status}]: ${text.slice(0, 300)}`);
    const message =
      res.status === 429
        ? "Transcription is rate limited right now. Try again shortly."
        : res.status === 402
          ? "AI credits are exhausted, so this call was not transcribed."
          : "Transcription failed for this recording.";
    throw new TranscriptionUnavailable(message, res.status);
  }

  try {
    const parsed = JSON.parse(text) as { text?: string };
    return (parsed.text ?? "").trim();
  } catch {
    return text.trim();
  }
}

/** Convenience: recording URL in, transcript text out. */
export async function transcribeRecordingUrl(url: string): Promise<string> {
  const audio = await fetchRecording(url);
  return transcribeAudio(audio);
}