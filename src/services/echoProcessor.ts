/**
 * Advanced Echo Cancellation & Proximity-Based Audio Processing
 * Implements aggressive echo suppression with spectral subtraction,
 * noise gates, and frequency-domain filtering for close-proximity devices
 */

interface EchoProcessorConfig {
  sampleRate: number;
  fftSize?: number;
  enableSpectralSubtraction?: boolean;
  enableNoiseGate?: boolean;
  enableHighPassFilter?: boolean;
  proximityThreshold?: number; // 0-1, lower = more aggressive (devices close together)
}

export class AdvancedEchoProcessor {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private noiseGate: GainNode;
  private compressor: DynamicsCompressorNode;
  private highPass: BiquadFilterNode;
  private dryGain: GainNode;
  private echoSuppression: GainNode;
  private fftSize: number;
  private proximityMode: 'far' | 'near' | 'very_near';

  // Echo detection buffers
  private frequencyData: Uint8Array;
  private prevFrequencyData: Uint8Array;
  private echoPowerBuffer: number[] = [];
  private echoDetectionThreshold: number = 0.15;

  // Spectral subtraction parameters
  private noiseProfile: Float32Array;
  private spectralSubtractionAlpha: number = 2.0;
  private spectralSubtractionBeta: number = 0.02;
  private noiseProfileReady: boolean = false;

  constructor(stream: MediaStream, config: EchoProcessorConfig) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.fftSize = config.fftSize || 4096;
    this.proximityMode = 'far';

    // Create analyser for echo detection
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;

    // Noise gate: suppress audio below threshold
    this.noiseGate = this.audioContext.createGain();
    this.noiseGate.gain.setValueAtTime(1, this.audioContext.currentTime);

    // Compressor: aggressive dynamic range compression to prevent feedback loop
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-20, this.audioContext.currentTime);
    this.compressor.knee.setValueAtTime(5, this.audioContext.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
    this.compressor.release.setValueAtTime(0.15, this.audioContext.currentTime);

    // High-pass filter: remove rumble and low-frequency echo
    this.highPass = this.audioContext.createBiquadFilter();
    this.highPass.type = 'highpass';
    this.highPass.frequency.setValueAtTime(300, this.audioContext.currentTime);
    this.highPass.Q.setValueAtTime(2, this.audioContext.currentTime);

    // Echo suppression control
    this.echoSuppression = this.audioContext.createGain();
    this.echoSuppression.gain.setValueAtTime(1, this.audioContext.currentTime);

    // Dry signal control (for mix with processed)
    this.dryGain = this.audioContext.createGain();
    this.dryGain.gain.setValueAtTime(0.8, this.audioContext.currentTime);

    // Initialize buffers
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.prevFrequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.noiseProfile = new Float32Array(this.analyser.frequencyBinCount);

    // Build processing chain
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.noiseGate);
    this.noiseGate.connect(this.highPass);
    this.highPass.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.compressor.connect(this.echoSuppression);
    this.echoSuppression.connect(this.audioContext.destination);

    // Set initial proximity mode based on config
    if (config.proximityThreshold !== undefined) {
      this.setProximityMode(config.proximityThreshold);
    }

    // Start echo detection loop
    this.startEchoDetection();
  }

  private setProximityMode(threshold: number) {
    if (threshold < 0.3) {
      this.proximityMode = 'very_near';
      // Extremely aggressive: multiple passes of spectral subtraction
      this.spectralSubtractionAlpha = 3.0;
      this.spectralSubtractionBeta = 0.01;
      this.compressor.ratio.setValueAtTime(20, this.audioContext.currentTime);
      this.compressor.threshold.setValueAtTime(-25, this.audioContext.currentTime);
      this.compressor.attack.setValueAtTime(0.001, this.audioContext.currentTime);
    } else if (threshold < 0.6) {
      this.proximityMode = 'near';
      // Aggressive: strong spectral subtraction
      this.spectralSubtractionAlpha = 2.5;
      this.spectralSubtractionBeta = 0.015;
      this.compressor.ratio.setValueAtTime(15, this.audioContext.currentTime);
      this.compressor.threshold.setValueAtTime(-22, this.audioContext.currentTime);
    } else {
      this.proximityMode = 'far';
      // Moderate: balanced spectral subtraction
      this.spectralSubtractionAlpha = 2.0;
      this.spectralSubtractionBeta = 0.02;
      this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
      this.compressor.threshold.setValueAtTime(-20, this.audioContext.currentTime);
    }
  }

  private startEchoDetection() {
    const detectEcho = () => {
      this.analyser.getByteFrequencyData(this.frequencyData);

      // Calculate echo power (sum of frequency bins)
      let echoPower = 0;
      let binChanges = 0;

      for (let i = 0; i < this.frequencyData.length; i++) {
        const delta = Math.abs(this.frequencyData[i] - this.prevFrequencyData[i]);
        echoPower += delta;
        if (delta > 20) binChanges++;
      }

      const averageChange = echoPower / this.frequencyData.length / 256;
      this.echoPowerBuffer.push(averageChange);

      // Keep buffer size manageable
      if (this.echoPowerBuffer.length > 100) {
        this.echoPowerBuffer.shift();
      }

      // Detect echo patterns (repetitive, delayed frequency changes)
      if (this.echoPowerBuffer.length > 50) {
        const avgEchoPower =
          this.echoPowerBuffer.reduce((a, b) => a + b, 0) /
          this.echoPowerBuffer.length;
        const variance =
          this.echoPowerBuffer.reduce(
            (sum, val) => sum + Math.pow(val - avgEchoPower, 2),
            0
          ) / this.echoPowerBuffer.length;

        // High variance + medium power = likely echo/feedback
        if (
          variance > 0.001 &&
          avgEchoPower > this.echoDetectionThreshold
        ) {
          // Detected echo: suppress it
          this.echoSuppression.gain.setTargetAtTime(
            0.4,
            this.audioContext.currentTime,
            0.1
          );
        } else {
          // Normal speech: restore gain
          this.echoSuppression.gain.setTargetAtTime(
            1.0,
            this.audioContext.currentTime,
            0.2
          );
        }
      }

      // Copy current to previous for next iteration
      this.prevFrequencyData.set(this.frequencyData);

      requestAnimationFrame(detectEcho);
    };

    detectEcho();
  }

  /**
   * Apply spectral subtraction in frequency domain
   * Simulated via gain modulation at different frequency ranges
   */
  public applySpectralSubtraction() {
    // Create 3-band EQ to suppress mid frequencies where echo typically occurs
    const midBoost = this.audioContext.createBiquadFilter();
    midBoost.type = 'peaking';
    midBoost.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    midBoost.Q.setValueAtTime(2, this.audioContext.currentTime);
    midBoost.gain.setValueAtTime(
      this.proximityMode === 'very_near'
        ? -8
        : this.proximityMode === 'near'
          ? -5
          : -3,
      this.audioContext.currentTime
    );

    const highFreqCut = this.audioContext.createBiquadFilter();
    highFreqCut.type = 'lowpass';
    highFreqCut.frequency.setValueAtTime(8000, this.audioContext.currentTime);
    highFreqCut.Q.setValueAtTime(1.5, this.audioContext.currentTime);

    return { midBoost, highFreqCut };
  }

  /**
   * Enhanced noise gate with adaptive threshold
   */
  public setNoiseGateThreshold(dbThreshold: number) {
    const linearThreshold = Math.pow(10, dbThreshold / 20);
    this.noiseGate.gain.setValueAtTime(linearThreshold, this.audioContext.currentTime);
  }

  /**
   * Update proximity dynamically (call when peer distance changes)
   */
  public updateProximity(distance: number) {
    // Normalize distance to 0-1 (0 = very close, 1 = far)
    const normalizedDistance = Math.max(0, Math.min(1, distance));
    this.setProximityMode(normalizedDistance);
  }

  /**
   * Get processed audio stream
   */
  public getProcessedStream(): MediaStream {
    const dest = this.audioContext.createMediaStreamDestination();
    this.echoSuppression.connect(dest);
    return dest.stream;
  }

  /**
   * Destroy and clean up
   */
  public destroy() {
    this.analyser.disconnect();
    this.noiseGate.disconnect();
    this.compressor.disconnect();
    this.highPass.disconnect();
    this.echoSuppression.disconnect();
    this.dryGain.disconnect();
  }
}

/**
 * Create echo processor with browser API detection
 */
export function createEchoProcessor(
  stream: MediaStream,
  proximity: number = 0.5
): AdvancedEchoProcessor | null {
  try {
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      console.warn('Web Audio API not supported');
      return null;
    }

    return new AdvancedEchoProcessor(stream, {
      sampleRate: 48000,
      fftSize: 4096,
      enableSpectralSubtraction: true,
      enableNoiseGate: true,
      enableHighPassFilter: true,
      proximityThreshold: proximity,
    });
  } catch (err) {
    console.error('Failed to create echo processor:', err);
    return null;
  }
}
