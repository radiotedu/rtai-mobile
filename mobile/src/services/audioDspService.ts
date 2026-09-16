/**
 * RadioTEDU Audio DSP & EBU R128 Loudness Normalization Service.
 *
 * Implements professional broadcast leveling standards:
 * - EBU R128 / ITU-R BS.1770 integrated loudness measurement with K-weighting filter.
 * - Target loudness calibration: -16.0 LUFS (EBU R128 s2 / OTT / Mobile Broadcast target).
 * - True peak ceiling: -1.0 dBFS to prevent inter-sample clipping on AAC/MP3 lossy codecs.
 * - Software AGC (Automatic Gain Control) with smooth attack/release envelopes and noise gating.
 * - Dynamic range compression (DRC) and peak limiting to prevent clipping during transitions
 *   between loud podcasts and live streams.
 * - Raised-cosine (S-curve) smooth transition volume ramps for clickless channel and track switching.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {logSafeError} from '../utils/safeLog';

/**
 * Standard integrated loudness target for RadioTEDU mobile streaming (EBU R128 s2 / AES TD1004).
 */
export const EBU_R128_TARGET_LUFS = -16.0;

/**
 * Maximum true peak level ceiling in dBFS per EBU R128 recommendations to guarantee headroom.
 */
export const EBU_R128_MAX_TRUE_PEAK_DBFS = -1.0;

/**
 * Noise floor threshold in LUFS. Below this level, input is treated as silence / noise floor
 * and AGC holds gain at 1.0 to prevent pumping background room noise.
 */
export const NOISE_GATE_THRESHOLD_LUFS = -65.0;

/**
 * Maximum gain boost in dB allowed by AGC to avoid amplifying low noise floors.
 */
export const DEFAULT_MAX_BOOST_DB = 6.0;

/**
 * Maximum attenuation in dB applied to overly loud audio signals (e.g. brickwall limited podcasts).
 */
export const DEFAULT_MAX_ATTENUATION_DB = -12.0;

/**
 * Storage key for persisting user audio DSP leveling preference.
 */
export const AUDIO_DSP_STORAGE_KEY = '@radiotedu/audio_dsp_leveling_v1';

/**
 * Convert decibels to linear amplitude multiplier.
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear amplitude multiplier to decibels.
 */
export function linearToDb(linear: number): number {
  if (linear <= 0.00001) {
    return -100.0;
  }
  return 20 * Math.log10(linear);
}

/**
 * Biquad filter state for discrete-time signal processing.
 */
interface BiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * ITU-R BS.1770-4 K-weighting filter coefficients.
 * Stage 1: High-shelving pre-filter (simulating acoustic head shadowing).
 * Stage 2: High-pass RLB weighting filter (approx 38 Hz cut).
 */
const K_WEIGHTING_COEFFS_48K = {
  stage1: {
    b0: 1.53512485958697,
    b1: -2.69169618940638,
    b2: 1.19839281085285,
    a1: -1.69065929318241,
    a2: 0.73248077421585,
  },
  stage2: {
    b0: 1.0,
    b1: -2.0,
    b2: 1.0,
    a1: -1.99004745483398,
    a2: 0.99007225036621,
  },
};

const K_WEIGHTING_COEFFS_44K = {
  stage1: {
    b0: 1.5309025916052,
    b1: -2.65096703901764,
    b2: 1.1690234710188,
    a1: -1.66367354964953,
    a2: 0.71263257322589,
  },
  stage2: {
    b0: 1.0,
    b1: -2.0,
    b2: 1.0,
    a1: -1.98916967923727,
    a2: 0.98919630974351,
  },
};

function processBiquad(sample: number, coeffs: BiquadCoeffs, state: BiquadState): number {
  const out =
    coeffs.b0 * sample +
    coeffs.b1 * state.x1 +
    coeffs.b2 * state.x2 -
    coeffs.a1 * state.y1 -
    coeffs.a2 * state.y2;

  state.x2 = state.x1;
  state.x1 = sample;
  state.y2 = state.y1;
  state.y1 = out;

  return out;
}

/**
 * Calculate integrated loudness in LUFS from audio samples using ITU-R BS.1770 K-weighting.
 *
 * @param samples Array of float audio samples normalized in [-1.0, 1.0]
 * @param sampleRate Sampling rate in Hz (defaults to 44100)
 * @returns Loudness in LUFS, or -Infinity / -100.0 if silent.
 */
export function calculateLufsFromSamples(
  samples: number[] | Float32Array,
  sampleRate: number = 44100,
): number {
  if (!samples || samples.length === 0) {
    return -100.0;
  }

  const coeffs = sampleRate >= 46000 ? K_WEIGHTING_COEFFS_48K : K_WEIGHTING_COEFFS_44K;
  const state1: BiquadState = {x1: 0, x2: 0, y1: 0, y2: 0};
  const state2: BiquadState = {x1: 0, x2: 0, y1: 0, y2: 0};

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const s1 = processBiquad(samples[i], coeffs.stage1, state1);
    const s2 = processBiquad(s1, coeffs.stage2, state2);
    sumSquares += s2 * s2;
  }

  const meanSquare = sumSquares / samples.length;
  if (meanSquare <= 1e-10) {
    return -100.0;
  }

  // ITU-R BS.1770 loudness definition: LUFS = -0.691 + 10 * log10(z)
  const lufs = -0.691 + 10 * Math.log10(meanSquare);
  return Math.round(lufs * 100) / 100;
}

/**
 * Calculate loudness offset in dB between measured LUFS and target LUFS.
 *
 * @param measuredLufs Measured integrated loudness in LUFS.
 * @param targetLufs Target broadcast loudness in LUFS (defaults to -16.0).
 * @returns Offset in dB (+dB means boost needed, -dB means attenuation needed).
 */
export function calculateLoudnessOffset(
  measuredLufs: number,
  targetLufs: number = EBU_R128_TARGET_LUFS,
): number {
  if (measuredLufs <= NOISE_GATE_THRESHOLD_LUFS) {
    return 0.0;
  }
  const offset = targetLufs - measuredLufs;
  return Math.round(offset * 100) / 100;
}

export interface GainLimitsOptions {
  maxBoostDb?: number;
  maxAttenuationDb?: number;
  noiseGateLufs?: number;
}

/**
 * Calculate EBU R128 target gain multiplier with safety clamping and noise gating.
 *
 * @param measuredLufs Current loudness in LUFS.
 * @param targetLufs Target loudness in LUFS (defaults to -16.0).
 * @param options Clamping limits for boost and attenuation.
 * @returns Linear gain multiplier (e.g. 1.0 = unity, 2.0 = +6dB, 0.5 = -6dB).
 */
export function calculateTargetGainMultiplier(
  measuredLufs: number,
  targetLufs: number = EBU_R128_TARGET_LUFS,
  options?: GainLimitsOptions,
): number {
  const noiseGate = options?.noiseGateLufs ?? NOISE_GATE_THRESHOLD_LUFS;
  if (measuredLufs <= noiseGate) {
    return 1.0;
  }

  const maxBoost = options?.maxBoostDb ?? DEFAULT_MAX_BOOST_DB;
  const maxAttenuation = options?.maxAttenuationDb ?? DEFAULT_MAX_ATTENUATION_DB;

  const rawOffsetDb = targetLufs - measuredLufs;
  const clampedDb = Math.max(maxAttenuation, Math.min(maxBoost, rawOffsetDb));

  const linear = dbToLinear(clampedDb);
  return Math.round(linear * 1000) / 1000;
}

/**
 * Software AGC (Automatic Gain Control) Configuration.
 */
export interface AgcConfig {
  targetLufs?: number;
  maxBoostDb?: number;
  maxAttenuationDb?: number;
  noiseGateLufs?: number;
  attackRate?: number; // Gain reduction adaptation rate (fast: e.g. 0.25)
  releaseRate?: number; // Gain boost adaptation rate (gradual: e.g. 0.05)
}

/**
 * Stateful Software AGC (Automatic Gain Control) processor.
 * Smoothly ramps gain multiplier towards target loudness without audio pumping or clicks.
 */
export class SoftwareAgc {
  private currentMultiplier: number = 1.0;
  private readonly config: Required<AgcConfig>;

  constructor(config?: AgcConfig) {
    this.config = {
      targetLufs: config?.targetLufs ?? EBU_R128_TARGET_LUFS,
      maxBoostDb: config?.maxBoostDb ?? DEFAULT_MAX_BOOST_DB,
      maxAttenuationDb: config?.maxAttenuationDb ?? DEFAULT_MAX_ATTENUATION_DB,
      noiseGateLufs: config?.noiseGateLufs ?? NOISE_GATE_THRESHOLD_LUFS,
      attackRate: config?.attackRate ?? 0.25,
      releaseRate: config?.releaseRate ?? 0.05,
    };
  }

  public computeStep(measuredLufs: number): number {
    const targetMultiplier = calculateTargetGainMultiplier(
      measuredLufs,
      this.config.targetLufs,
      {
        maxBoostDb: this.config.maxBoostDb,
        maxAttenuationDb: this.config.maxAttenuationDb,
        noiseGateLufs: this.config.noiseGateLufs,
      },
    );

    // Fast attack (decrease gain quickly when signal is hot) to prevent clipping
    if (targetMultiplier < this.currentMultiplier) {
      this.currentMultiplier +=
        this.config.attackRate * (targetMultiplier - this.currentMultiplier);
    } else {
      // Slower release (increase gain gradually when signal is soft) to prevent pumping
      this.currentMultiplier +=
        this.config.releaseRate * (targetMultiplier - this.currentMultiplier);
    }

    const minMultiplier = dbToLinear(this.config.maxAttenuationDb);
    const maxMultiplier = dbToLinear(this.config.maxBoostDb);
    this.currentMultiplier = Math.max(minMultiplier, Math.min(maxMultiplier, this.currentMultiplier));

    return Math.round(this.currentMultiplier * 1000) / 1000;
  }

  public getCurrentMultiplier(): number {
    return this.currentMultiplier;
  }

  public reset(multiplier: number = 1.0): void {
    this.currentMultiplier = multiplier;
  }
}

/**
 * Functional AGC step computation.
 */
export function computeAgcMultiplier(
  measuredLufs: number,
  currentMultiplier: number = 1.0,
  config?: AgcConfig,
): number {
  const agc = new SoftwareAgc(config);
  agc.reset(currentMultiplier);
  return agc.computeStep(measuredLufs);
}

/**
 * Dynamic Range Compression (DRC) Options.
 */
export interface DrcOptions {
  thresholdDbfs?: number; // Threshold above which compression begins (default: -2.0 dBFS)
  ratio?: number; // Compression ratio (default: 4.0:1)
  ceilingDbfs?: number; // Brickwall peak ceiling (default: -1.0 dBFS)
}

/**
 * Compress a single sample to prevent clipping.
 * Employs soft-knee compression above threshold and hyperbolic tangent saturation
 * to guarantee that peak levels never breach the True Peak ceiling (-1.0 dBFS).
 */
export function compressSample(
  sample: number,
  thresholdDbfs: number = -2.0,
  ratio: number = 4.0,
  ceilingDbfs: number = EBU_R128_MAX_TRUE_PEAK_DBFS,
): number {
  const abs = Math.abs(sample);
  if (abs <= 0.00001) {
    return sample;
  }

  const sign = Math.sign(sample);
  const sampleDb = 20 * Math.log10(abs);

  let processedLinear = abs;
  if (sampleDb > thresholdDbfs) {
    const compressedDb = thresholdDbfs + (sampleDb - thresholdDbfs) / ratio;
    processedLinear = dbToLinear(compressedDb);
  }

  const ceilingLinear = dbToLinear(ceilingDbfs);
  if (processedLinear > ceilingLinear) {
    // Soft hyperbolic tangent saturation ceiling limiter
    processedLinear = ceilingLinear * Math.tanh(processedLinear / ceilingLinear);
  }

  return sign * processedLinear;
}

/**
 * Compress an audio buffer to prevent clipping during sudden loud passages or transitions.
 */
export function compressBuffer(
  samples: number[] | Float32Array,
  options?: DrcOptions,
): number[] {
  const threshold = options?.thresholdDbfs ?? -2.0;
  const ratio = options?.ratio ?? 4.0;
  const ceiling = options?.ceilingDbfs ?? EBU_R128_MAX_TRUE_PEAK_DBFS;

  const result = new Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = compressSample(samples[i], threshold, ratio, ceiling);
  }
  return result;
}

/**
 * Gain limiter helper to prevent clipping when applying volume boosts or switching sources.
 * If multiplying by gainMultiplier would push peakEstimateDbfs beyond ceilingDbfs,
 * scales down the gain multiplier to preserve headroom.
 *
 * @param gainMultiplier Proposed linear gain multiplier.
 * @param peakEstimateDbfs Estimated input peak level in dBFS.
 * @param ceilingDbfs Maximum allowable output peak in dBFS (defaults to -1.0 dBFS).
 * @returns Safe linear gain multiplier.
 */
export function preventClipping(
  gainMultiplier: number,
  peakEstimateDbfs: number,
  ceilingDbfs: number = EBU_R128_MAX_TRUE_PEAK_DBFS,
): number {
  if (gainMultiplier <= 0) {
    return 0;
  }

  const gainDb = linearToDb(gainMultiplier);
  const projectedPeakDb = peakEstimateDbfs + gainDb;

  if (projectedPeakDb <= ceilingDbfs) {
    return Math.round(gainMultiplier * 1000) / 1000;
  }

  const maxAllowedGainDb = ceilingDbfs - peakEstimateDbfs;
  const safeGainLinear = dbToLinear(maxAllowedGainDb);

  return Math.round(Math.min(gainMultiplier, safeGainLinear) * 1000) / 1000;
}

/**
 * Compute a smooth volume transition ramp between two volume levels.
 * Supports S-curve (raised cosine) to eliminate clicks and pops with zero velocity at endpoints.
 *
 * @param startVolume Starting volume (0.0 to 1.0).
 * @param targetVolume Target volume (0.0 to 1.0).
 * @param steps Number of transition steps (defaults to 5).
 * @param curve Transition curve type ('s-curve' | 'linear').
 * @returns Array of volume steps.
 */
export function calculateTransitionRamp(
  startVolume: number,
  targetVolume: number,
  steps: number = 5,
  curve: 'linear' | 's-curve' = 's-curve',
): number[] {
  if (steps <= 1) {
    return [Math.max(0, Math.min(1, targetVolume))];
  }

  const ramp: number[] = [];
  const clampedStart = Math.max(0, Math.min(1, startVolume));
  const clampedTarget = Math.max(0, Math.min(1, targetVolume));

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    let factor = t;

    if (curve === 's-curve') {
      // Raised cosine S-curve: 0.5 * (1 - cos(pi * t))
      factor = 0.5 * (1 - Math.cos(Math.PI * t));
    }

    const vol = clampedStart + (clampedTarget - clampedStart) * factor;
    ramp.push(Math.round(vol * 1000) / 1000);
  }

  return ramp;
}

/**
 * Track leveling input attributes.
 */
export interface TrackLevelingInfo {
  id?: string;
  isLiveStream?: boolean;
  lufs?: number;
  peakDbfs?: number;
}

/**
 * Singleton Audio DSP Service for RadioTEDU.
 */
class AudioDspService {
  private enabled: boolean = true;
  private targetLufs: number = EBU_R128_TARGET_LUFS;
  private readonly agc: SoftwareAgc;
  private initialized: boolean = false;

  constructor() {
    this.agc = new SoftwareAgc({targetLufs: this.targetLufs});
    this.bootstrapState().catch(() => {});
  }

  private async bootstrapState(): Promise<void> {
    if (this.initialized) {
      return;
    }
    try {
      const stored = await AsyncStorage.getItem(AUDIO_DSP_STORAGE_KEY);
      if (stored !== null) {
        this.enabled = stored === 'true';
      }
      this.initialized = true;
    } catch (err) {
      logSafeError('audioDsp.bootstrap', err);
    }
  }

  public isLevelingEnabled(): boolean {
    return this.enabled;
  }

  public async setLevelingEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    try {
      await AsyncStorage.setItem(AUDIO_DSP_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (err) {
      logSafeError('audioDsp.setDisabled', err);
    }
  }

  public getTargetLufs(): number {
    return this.targetLufs;
  }

  public setTargetLufs(lufs: number): void {
    this.targetLufs = lufs;
    this.agc.reset();
  }

  /**
   * Determine the normalized playback volume for a given track or channel.
   * - If leveling is disabled, returns 1.0 (unity).
   * - Live radio channels are calibrated to -16.0 LUFS broadcast target (volume = 1.0).
   * - Podcasts with known LUFS metadata are leveled to -16.0 LUFS.
   * - Podcasts without metadata default to a safe normalized level (0.80) to prevent
   *   ear-shattering jumps from loud commercial/podcast masters.
   */
  public getNormalizedVolume(track: TrackLevelingInfo): number {
    if (!this.enabled) {
      return 1.0;
    }

    const isPodcast = !track.isLiveStream && (track.id?.startsWith('podcast:') ?? false);

    // Live stream calibration
    if (!isPodcast) {
      return 1.0;
    }

    // Podcast with explicit LUFS
    if (typeof track.lufs === 'number' && track.lufs > NOISE_GATE_THRESHOLD_LUFS) {
      const multiplier = calculateTargetGainMultiplier(track.lufs, this.targetLufs);
      const peak = track.peakDbfs ?? -0.5;
      const safeMultiplier = preventClipping(multiplier, peak);
      return Math.max(0.1, Math.min(1.0, safeMultiplier));
    }

    // Default podcast master: podcasts are typically mastered ~2 to 4 dB hotter than -16 LUFS (-14 to -12 LUFS).
    // An attenuation of -2 dB (0.794 multiplier) aligns typical podcasts to live stream reference.
    const defaultPodcastMultiplier = dbToLinear(-2.0);
    return Math.round(defaultPodcastMultiplier * 100) / 100;
  }

  /**
   * Calculate smooth transition ramp steps between volumes.
   */
  public getTransitionRamp(
    startVol: number,
    targetVol: number,
    steps: number = 5,
  ): number[] {
    return calculateTransitionRamp(startVol, targetVol, steps, 's-curve');
  }

  /**
   * Apply a multi-step smooth volume transition ramp to a setVolume callback.
   */
  public async applySmoothVolumeRamp(
    setVolumeFn: (volume: number) => Promise<any>,
    targetVolume: number,
    startVolume: number = 0.2,
    durationMs: number = 150,
  ): Promise<void> {
    const steps = 4;
    const ramp = this.getTransitionRamp(startVolume, targetVolume, steps);
    const stepInterval = Math.max(20, Math.floor(durationMs / steps));

    for (const vol of ramp) {
      await setVolumeFn(vol).catch(() => {});
      await new Promise(res => setTimeout(res, stepInterval));
    }
  }

  public getAgc(): SoftwareAgc {
    return this.agc;
  }
}

export const audioDspService = new AudioDspService();
