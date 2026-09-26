import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { cacheDirectory, writeAsStringAsync } from "expo-file-system/legacy";

let player: AudioPlayer | null = null;

async function materialize(url: string): Promise<string> {
  const match = /^data:[^;]+;base64,(.+)$/.exec(url);
  if (!match || !cacheDirectory) return url;
  const path = `${cacheDirectory}sixvox-voicemail.mp3`;
  await writeAsStringAsync(path, match[1] ?? "", { encoding: "base64" });
  return path;
}

export async function playUrl(url: string): Promise<void> {
  await stopPlayback();
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers" });
  player = createAudioPlayer(await materialize(url));
  player.play();
}

export async function stopPlayback(): Promise<void> {
  player?.remove();
  player = null;
}
