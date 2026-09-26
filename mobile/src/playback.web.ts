let audio: HTMLAudioElement | null = null;

export async function playUrl(url: string): Promise<void> {
  await stopPlayback();
  audio = new Audio(url);
  await audio.play();
}

export async function stopPlayback(): Promise<void> {
  audio?.pause();
  audio = null;
}
