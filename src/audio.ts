// Tiny WebAudio synth — no audio assets needed for the prototype.

class Sfx {
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur = 0.08, type: OscillatorType = "square", vol = 0.04, when = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Browsers require a user gesture before audio — call from the first pointerdown. */
  unlockAudio(): void {
    this.ensure();
  }

  pickup(): void {
    this.tone(520, 0.05, "triangle", 0.05);
  }

  drop(): void {
    this.tone(390, 0.05, "triangle", 0.05);
  }

  serve(): void {
    this.tone(660, 0.07, "sine", 0.05);
  }

  coin(): void {
    this.tone(880, 0.06, "square", 0.035);
    this.tone(1320, 0.09, "square", 0.03, 0.05);
  }

  upgrade(): void {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.09, "triangle", 0.05, i * 0.06));
  }

  unlock(): void {
    [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.05, i * 0.08));
  }

  deny(): void {
    this.tone(160, 0.12, "sawtooth", 0.04);
  }
}

export const sfx = new Sfx();
