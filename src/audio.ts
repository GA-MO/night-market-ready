// Tiny WebAudio synth — no audio assets needed for the prototype.

class Sfx {
  private ctx: AudioContext | null = null;
  private ambientStarted = false;

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
    this.startAmbient();
  }

  /** Subtle, looping night-market ambience: a warm pad + a soft crowd bed. */
  private startAmbient(): void {
    const ctx = this.ensure();
    if (!ctx || this.ambientStarted) return;
    this.ambientStarted = true;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5); // gentle fade-in
    master.connect(ctx.destination);

    // Warm low pad (a few detuned sines).
    const padGains = [0.01, 0.009, 0.005];
    [110, 165, 220].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      osc.detune.value = (i - 1) * 5;
      const g = ctx.createGain();
      g.gain.value = padGains[i];
      osc.connect(g).connect(master);
      osc.start();
    });

    // Soft "crowd" bed: looping white noise through a low-pass.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 480;
    const ng = ctx.createGain();
    ng.gain.value = 0.006;
    noise.connect(lp).connect(ng).connect(master);
    noise.start();

    // Slow breathing tremolo on the noise bed for life.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.003;
    lfo.connect(lfoG).connect(ng.gain);
    lfo.start();
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

  star(): void {
    [659, 880, 1047, 1319].forEach((f, i) => this.tone(f, 0.1, "triangle", 0.05, i * 0.07));
  }

  prestige(): void {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.14, "triangle", 0.05, i * 0.08));
  }

  deny(): void {
    this.tone(160, 0.12, "sawtooth", 0.04);
  }

  /** Rising blip per combo step — pitch climbs as the streak grows. */
  comboTick(step: number): void {
    this.tone(480 + Math.min(step, 16) * 55, 0.05, "triangle", 0.045);
  }

  /** Frenzy ignition fanfare. */
  frenzy(): void {
    [659, 784, 988, 1319, 1568].forEach((f, i) => this.tone(f, 0.11, "square", 0.045, i * 0.05));
  }

  /** Tour-bus horn: a short two-note sawtooth chord. */
  rush(): void {
    this.tone(220, 0.28, "sawtooth", 0.045);
    this.tone(277, 0.28, "sawtooth", 0.045);
  }

  /** Lucky-cat chirp: a quick falling meow-ish slide. */
  meow(): void {
    this.tone(920, 0.08, "sine", 0.05);
    this.tone(690, 0.12, "sine", 0.04, 0.07);
  }
}

export const sfx = new Sfx();
