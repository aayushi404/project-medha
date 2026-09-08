"use client";

/**
 * Plays a queue of audio clips strictly one at a time.
 *
 * `/speech/converse` streams one clip per sentence, so several land while an
 * earlier one is still playing. Two things keep it robust:
 *  - each clip's `<audio>` is attached to the DOM while it plays; a detached
 *    element can be GC'd or refused mid-play ("media was removed from the
 *    document") in some Chrome contexts;
 *  - a monotonic `token` is captured per clip, so a clip whose token is stale
 *    (because `stop()` ran) neither advances the queue nor fires `onDrain` —
 *    without that a new turn can get two clips talking at once.
 */
export class SequentialAudioPlayer {
  private queue: string[] = [];
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private playing = false;
  private token = 0;

  /** Fires once the queue empties after at least one clip has played. */
  onDrain: (() => void) | null = null;

  enqueue(url: string): void {
    this.queue.push(url);
    if (!this.playing) this.playNext();
  }

  private playNext(): void {
    const url = this.queue.shift();
    if (url === undefined) {
      this.playing = false;
      this.audio = null;
      this.currentUrl = null;
      this.onDrain?.();
      return;
    }

    this.playing = true;
    const myToken = this.token;
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.style.display = "none";
    if (typeof document !== "undefined") document.body.appendChild(audio);
    this.audio = audio;
    this.currentUrl = url;

    const done = () => {
      const stale = myToken !== this.token; // stop() ran and already cleaned up
      audio.onended = null;
      audio.onerror = null;
      if (stale) return;
      audio.remove();
      URL.revokeObjectURL(url);
      this.playNext();
    };
    audio.onended = done;
    audio.onerror = done;
    // Swallow the play() rejection (autoplay block, or stop() pausing it);
    // only skip to the next clip if we weren't stopped.
    audio.play().catch(() => {
      if (myToken === this.token) done();
    });
  }

  /** Stop now and drop anything queued. Does not fire `onDrain`. */
  stop(): void {
    this.token += 1;
    for (const url of this.queue) URL.revokeObjectURL(url);
    this.queue = [];
    const a = this.audio;
    const url = this.currentUrl;
    this.audio = null;
    this.currentUrl = null;
    this.playing = false;
    if (a) {
      a.onended = null;
      a.onerror = null;
      try {
        a.pause();
      } catch {
        /* ignore */
      }
      a.remove();
    }
    if (url) URL.revokeObjectURL(url);
  }

  get active(): boolean {
    return this.playing;
  }
}

/** Decode a base64 audio payload into a playable object URL (revoke after use). */
export function objectUrlFromBase64(b64: string, mime = "audio/wav"): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
