export const LIVE_INPUT_SAMPLE_RATE = 16000;
export const LIVE_OUTPUT_SAMPLE_RATE = 24000;

export const LIVE_VOICES = [
  { id: 'Zephyr', label: 'Zephyr' },
  { id: 'Puck', label: 'Puck' },
  { id: 'Charon', label: 'Charon' },
  { id: 'Kore', label: 'Kore' },
  { id: 'Fenrir', label: 'Fenrir' },
] as const;

export type LiveVoiceId = (typeof LIVE_VOICES)[number]['id'];

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function computeRmsNormalized(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 2) {
    sum += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sum / Math.max(1, samples.length / 2));
  return Math.min(1, rms * 4.5);
}

/**
 * Downsamples Float32 PCM from sourceSampleRate to 16000 Hz if needed,
 * and encodes as base64 16-bit signed little-endian PCM.
 */
export function encodeFloat32ToPcm16kHzBase64(
  input: Float32Array,
  sourceSampleRate: number
): string {
  let samples = input;
  if (sourceSampleRate !== LIVE_INPUT_SAMPLE_RATE && sourceSampleRate > 0) {
    const ratio = sourceSampleRate / LIVE_INPUT_SAMPLE_RATE;
    const newLength = Math.max(1, Math.floor(input.length / ratio));
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(input.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j++) {
        sum += input[j];
        count++;
      }
      resampled[i] = count > 0 ? sum / count : input[Math.min(start, input.length - 1)];
    }
    samples = resampled;
  }

  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(i * 2, int16, true);
  }
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

export function decodePcm16Base64ToFloat32(base64: string): Float32Array {
  const bytes = base64ToUint8Array(base64);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

/**
 * Gapless 24kHz PCM AudioContext player supporting immediate barge-in interruption
 * and live amplitude telemetry for reactive visualizers.
 */
export class LiveAudioPlayer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private onSpeakingChange?: (speaking: boolean) => void;

  constructor(onSpeakingChange?: (speaking: boolean) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: LIVE_OUTPUT_SAMPLE_RATE });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyserData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.analyser.connect(this.ctx.destination);
      this.nextStartTime = 0;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public async warmup(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  }

  public getOutputLevel(): number {
    if (!this.analyser || !this.analyserData || this.activeSources.size === 0) return 0;
    this.analyser.getByteFrequencyData(this.analyserData);
    let sum = 0;
    const count = Math.min(24, this.analyserData.length);
    for (let i = 0; i < count; i++) {
      sum += this.analyserData[i];
    }
    return Math.min(1, (sum / Math.max(1, count * 255)) * 2.2);
  }

  public enqueuePcmBase64(base64: string): void {
    if (!base64) return;
    const float32 = decodePcm16Base64ToFloat32(base64);
    if (float32.length === 0) return;

    const ctx = this.ensureContext();
    const audioBuffer = ctx.createBuffer(1, float32.length, LIVE_OUTPUT_SAMPLE_RATE);
    audioBuffer.copyToChannel(new Float32Array(float32), 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    if (this.analyser) {
      source.connect(this.analyser);
    } else {
      source.connect(ctx.destination);
    }

    const startAt = Math.max(ctx.currentTime + 0.01, this.nextStartTime);
    this.nextStartTime = startAt + audioBuffer.duration;

    this.activeSources.add(source);
    if (this.activeSources.size === 1) {
      this.onSpeakingChange?.(true);
    }

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.onSpeakingChange?.(false);
      }
    };

    source.start(startAt);
  }

  public interrupt(): void {
    for (const src of this.activeSources) {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.nextStartTime = this.ctx.currentTime;
    } else {
      this.nextStartTime = 0;
    }
    this.onSpeakingChange?.(false);
  }

  public close(): void {
    this.interrupt();
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }
    this.analyserData = null;
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }
}

export class LiveMicrophoneCapturer {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private zeroGain: GainNode | null = null;
  private muted = false;
  private latestLevel = 0;

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.latestLevel = 0;
  }

  public getInputLevel(): number {
    return this.muted ? 0 : this.latestLevel;
  }

  public async start(onAudioChunk: (base64Pcm: string) => void): Promise<void> {
    this.stop();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: LIVE_INPUT_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx({ sampleRate: LIVE_INPUT_SAMPLE_RATE });
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.zeroGain = this.ctx.createGain();
    this.zeroGain.gain.value = 0;

    this.processor.onaudioprocess = (event) => {
      if (this.muted || !this.ctx) {
        this.latestLevel = 0;
        return;
      }
      const inputData = event.inputBuffer.getChannelData(0);
      if (!inputData || inputData.length === 0) return;
      this.latestLevel = computeRmsNormalized(inputData);
      const base64 = encodeFloat32ToPcm16kHzBase64(inputData, this.ctx.sampleRate);
      onAudioChunk(base64);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.zeroGain);
    this.zeroGain.connect(this.ctx.destination);
  }

  public stop(): void {
    this.latestLevel = 0;
    if (this.processor) {
      try {
        this.processor.onaudioprocess = null;
        this.processor.disconnect();
      } catch {}
      this.processor = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }
    if (this.zeroGain) {
      try {
        this.zeroGain.disconnect();
      } catch {}
      this.zeroGain = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
      this.stream = null;
    }
  }
}

/**
 * Converts accumulated 16-bit signed mono PCM chunks (base64) into a playable WAV Blob.
 */
export function pcm16Base64ChunksToWavBlob(chunks: string[], sampleRate = 24000): Blob {
  let totalBytes = 0;
  const byteArrays: Uint8Array[] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    byteArrays.push(bytes);
    totalBytes += bytes.length;
  }

  const wavBuffer = new ArrayBuffer(44 + totalBytes);
  const view = new DataView(wavBuffer);

  // "RIFF"
  view.setUint32(0, 0x52494646, false);
  // file length - 8
  view.setUint32(4, 36 + totalBytes, true);
  // "WAVE"
  view.setUint32(8, 0x57415645, false);
  // "fmt "
  view.setUint32(12, 0x666d7420, false);
  // SubChunk1Size (16 for PCM)
  view.setUint32(16, 16, true);
  // AudioFormat (1 for PCM)
  view.setUint16(20, 1, true);
  // NumChannels (1 mono)
  view.setUint16(22, 1, true);
  // SampleRate
  view.setUint32(24, sampleRate, true);
  // ByteRate (SampleRate * NumChannels * BitsPerSample/8 = sampleRate * 2)
  view.setUint32(28, sampleRate * 2, true);
  // BlockAlign (NumChannels * BitsPerSample/8 = 2)
  view.setUint16(32, 2, true);
  // BitsPerSample (16 bits)
  view.setUint16(34, 16, true);
  // "data"
  view.setUint32(36, 0x64617461, false);
  // SubChunk2Size
  view.setUint32(40, totalBytes, true);

  const target = new Uint8Array(wavBuffer, 44);
  let offset = 0;
  for (const b of byteArrays) {
    target.set(b, offset);
    offset += b.length;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

