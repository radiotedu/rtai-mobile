import {beforeEach, describe, expect, it, jest} from '@jest/globals';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
    getQueue: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    stop: jest.fn(),
    setVolume: (jest.fn() as any).mockResolvedValue(undefined),
    skip: (jest.fn() as any).mockResolvedValue(undefined),
  },
  Capability: {},
  State: {None: 'none', Ready: 'ready', Playing: 'playing', Paused: 'paused', Stopped: 'stopped'},
  Event: {},
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: (jest.fn() as any).mockResolvedValue({isConnected: true, type: 'wifi'}),
}));
import {
  audioDspService,
  calculateLoudnessOffset,
  calculateLufsFromSamples,
  calculateTargetGainMultiplier,
  calculateTransitionRamp,
  compressBuffer,
  compressSample,
  computeAgcMultiplier,
  dbToLinear,
  DEFAULT_MAX_ATTENUATION_DB,
  DEFAULT_MAX_BOOST_DB,
  EBU_R128_MAX_TRUE_PEAK_DBFS,
  EBU_R128_TARGET_LUFS,
  linearToDb,
  NOISE_GATE_THRESHOLD_LUFS,
  preventClipping,
  SoftwareAgc,
} from '../services/audioDspService';
import {
  isAudioDspLeveling,
  setAudioDspLeveling,
} from '../services/playbackQueue';

describe('RadioTEDU Broadcast Audio DSP & EBU R128 Normalization', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await audioDspService.setLevelingEnabled(true);
    audioDspService.setTargetLufs(EBU_R128_TARGET_LUFS);
  });

  describe('Decibel and Linear Conversions', () => {
    it('converts 0 dB to 1.0 linear amplitude', () => {
      expect(dbToLinear(0)).toBeCloseTo(1.0, 5);
      expect(linearToDb(1.0)).toBeCloseTo(0.0, 4);
    });

    it('converts +6 dB to approx 2.0x linear factor', () => {
      expect(dbToLinear(6)).toBeCloseTo(1.995, 2);
    });

    it('converts -6 dB to approx 0.5x linear factor', () => {
      expect(dbToLinear(-6)).toBeCloseTo(0.501, 2);
    });

    it('handles near-zero linear values gracefully without crashing', () => {
      expect(linearToDb(0)).toBe(-100.0);
      expect(linearToDb(-1)).toBe(-100.0);
    });
  });

  describe('EBU R128 Loudness Calculation (BS.1770 K-weighting)', () => {
    it('measures silence as lowest floor (-100.0 LUFS)', () => {
      const silentBuffer = new Float32Array(1024).fill(0);
      const measured = calculateLufsFromSamples(silentBuffer, 44100);
      expect(measured).toBe(-100.0);
    });

    it('handles empty sample buffers safely', () => {
      expect(calculateLufsFromSamples([], 44100)).toBe(-100.0);
    });

    it('measures a 1 kHz full-scale sine wave around -3.0 to -3.7 LUFS', () => {
      const sampleRate = 48000;
      const freq = 1000;
      const numSamples = 4800; // 100ms
      const samples = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        samples[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
      }

      const lufs = calculateLufsFromSamples(samples, sampleRate);
      // Per ITU-R BS.1770, a 1 kHz full-scale sine wave is approximately -3.01 to -3.7 LUFS
      expect(lufs).toBeGreaterThanOrEqual(-4.0);
      expect(lufs).toBeLessThanOrEqual(-2.5);
    });

    it('measures lower amplitude signals with proportionally lower LUFS', () => {
      const sampleRate = 48000;
      const freq = 1000;
      const numSamples = 4800;
      const fullScale = new Float32Array(numSamples);
      const halfScale = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const val = Math.sin((2 * Math.PI * freq * i) / sampleRate);
        fullScale[i] = val;
        halfScale[i] = val * 0.5; // -6 dB amplitude
      }

      const fullLufs = calculateLufsFromSamples(fullScale, sampleRate);
      const halfLufs = calculateLufsFromSamples(halfScale, sampleRate);

      // Half amplitude should be approximately 6 dB lower
      expect(fullLufs - halfLufs).toBeCloseTo(6.0, 0);
    });
  });

  describe('EBU R128 Loudness Offset and Multiplier Computation', () => {
    it('calculates zero offset when measured LUFS matches target (-16.0 LUFS)', () => {
      const offset = calculateLoudnessOffset(-16.0, EBU_R128_TARGET_LUFS);
      expect(offset).toBe(0.0);

      const multiplier = calculateTargetGainMultiplier(-16.0, EBU_R128_TARGET_LUFS);
      expect(multiplier).toBe(1.0);
    });

    it('calculates positive boost for quiet audio (-22.0 LUFS -> +6.0 dB boost)', () => {
      const offset = calculateLoudnessOffset(-22.0, -16.0);
      expect(offset).toBe(6.0);

      const multiplier = calculateTargetGainMultiplier(-22.0, -16.0);
      expect(multiplier).toBeCloseTo(1.995, 2);
    });

    it('calculates negative attenuation for loud audio (-10.0 LUFS -> -6.0 dB attenuation)', () => {
      const offset = calculateLoudnessOffset(-10.0, -16.0);
      expect(offset).toBe(-6.0);

      const multiplier = calculateTargetGainMultiplier(-10.0, -16.0);
      expect(multiplier).toBeCloseTo(0.501, 2);
    });

    it('respects noise gate floor by holding gain at 1.0 during silence / noise', () => {
      const silentLufs = -70.0;
      expect(silentLufs).toBeLessThan(NOISE_GATE_THRESHOLD_LUFS);

      const offset = calculateLoudnessOffset(silentLufs, -16.0);
      expect(offset).toBe(0.0);

      const multiplier = calculateTargetGainMultiplier(silentLufs, -16.0);
      expect(multiplier).toBe(1.0);
    });

    it('enforces maximum boost and attenuation bounds', () => {
      // Extremely quiet signal (-40 LUFS) should be capped at max boost (+6 dB by default)
      const boostedMultiplier = calculateTargetGainMultiplier(-40.0, -16.0);
      const maxBoostLinear = dbToLinear(DEFAULT_MAX_BOOST_DB);
      expect(boostedMultiplier).toBeCloseTo(maxBoostLinear, 2);

      // Extremely hot signal (0 LUFS) should be capped at max attenuation (-12 dB by default)
      const attenuatedMultiplier = calculateTargetGainMultiplier(0.0, -16.0);
      const maxAttenLinear = dbToLinear(DEFAULT_MAX_ATTENUATION_DB);
      expect(attenuatedMultiplier).toBeCloseTo(maxAttenLinear, 2);
    });
  });

  describe('Gain Limiting & Dynamic Range Compression (DRC)', () => {
    it('prevents clipping by scaling down proposed gain multiplier when peak would exceed ceiling', () => {
      const proposedMultiplier = 2.0; // +6 dB boost
      const inputPeakDbfs = -3.0; // Projected peak would be +3.0 dBFS (CLIPPING!)
      const ceiling = EBU_R128_MAX_TRUE_PEAK_DBFS; // -1.0 dBFS

      const safeMultiplier = preventClipping(proposedMultiplier, inputPeakDbfs, ceiling);

      // Safe gain should be ceiling - peak = -1.0 - (-3.0) = +2.0 dB = 1.259x
      expect(safeMultiplier).toBeLessThan(proposedMultiplier);
      const outputPeak = inputPeakDbfs + linearToDb(safeMultiplier);
      expect(outputPeak).toBeLessThanOrEqual(ceiling + 0.01);
    });

    it('leaves gain multiplier untouched when projected peak is safely under ceiling', () => {
      const proposedMultiplier = 1.2; // ~1.58 dB boost
      const inputPeakDbfs = -10.0; // Projected peak = -8.42 dBFS (well below -1.0 dBFS)

      const safeMultiplier = preventClipping(proposedMultiplier, inputPeakDbfs);
      expect(safeMultiplier).toBeCloseTo(proposedMultiplier, 2);
    });

    it('compresses high-amplitude samples without clipping and bounds to ceiling', () => {
      // Small sample below -2.0 dBFS threshold (e.g. 0.5 = -6 dBFS)
      const cleanSample = 0.5;
      const cleanResult = compressSample(cleanSample, -2.0, 4.0, -1.0);
      expect(cleanResult).toBeCloseTo(cleanSample, 3);

      // Hot sample at 1.0 (0 dBFS)
      const hotSample = 1.0;
      const hotResult = compressSample(hotSample, -2.0, 4.0, -1.0);
      const ceilingLinear = dbToLinear(-1.0); // ~0.891

      expect(hotResult).toBeLessThan(hotSample);
      expect(Math.abs(hotResult)).toBeLessThanOrEqual(ceilingLinear + 0.01);
    });

    it('compresses an entire buffer safely preserving sign and phase', () => {
      const buffer = [-1.0, -0.5, 0.0, 0.5, 1.0];
      const compressed = compressBuffer(buffer);

      expect(compressed.length).toBe(buffer.length);
      expect(compressed[2]).toBe(0.0);
      expect(compressed[0]).toBeLessThan(0);
      expect(compressed[4]).toBeGreaterThan(0);
      expect(Math.abs(compressed[0])).toBeLessThanOrEqual(dbToLinear(EBU_R128_MAX_TRUE_PEAK_DBFS) + 0.01);
      expect(Math.abs(compressed[4])).toBeLessThanOrEqual(dbToLinear(EBU_R128_MAX_TRUE_PEAK_DBFS) + 0.01);
    });
  });

  describe('Software AGC (Automatic Gain Control)', () => {
    it('reacts with fast attack when encountering a hot signal', () => {
      const agc = new SoftwareAgc({targetLufs: -16.0, attackRate: 0.5, releaseRate: 0.1});
      expect(agc.getCurrentMultiplier()).toBe(1.0);

      // Incoming signal is hot (-10 LUFS)
      const step1 = agc.computeStep(-10.0);
      expect(step1).toBeLessThan(1.0);

      const step2 = agc.computeStep(-10.0);
      expect(step2).toBeLessThan(step1);
      expect(step2).toBeGreaterThanOrEqual(dbToLinear(-12.0));
    });

    it('reacts with gradual release when signal becomes quieter to avoid pumping', () => {
      const agc = new SoftwareAgc({targetLufs: -16.0, attackRate: 0.5, releaseRate: 0.1});
      agc.reset(0.5); // Started at attenuated level

      // Incoming signal is quiet (-22 LUFS)
      const step1 = agc.computeStep(-22.0);
      expect(step1).toBeGreaterThan(0.5);

      const step2 = agc.computeStep(-22.0);
      expect(step2).toBeGreaterThan(step1);
    });

    it('computes functional AGC steps via computeAgcMultiplier', () => {
      const current = 1.0;
      const next = computeAgcMultiplier(-12.0, current);
      expect(next).toBeLessThan(current);
    });
  });

  describe('Smooth Transition Volume Ramps', () => {
    it('computes S-curve transition ramp starting and ending at exact volume endpoints', () => {
      const startVol = 0.2;
      const targetVol = 1.0;
      const steps = 5;

      const ramp = calculateTransitionRamp(startVol, targetVol, steps, 's-curve');
      expect(ramp.length).toBe(steps);
      expect(ramp[0]).toBe(startVol);
      expect(ramp[ramp.length - 1]).toBe(targetVol);
    });

    it('generates monotonically increasing ramp for fade-in / station switch', () => {
      const ramp = calculateTransitionRamp(0.2, 0.8, 6, 's-curve');
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i]).toBeGreaterThanOrEqual(ramp[i - 1]);
      }
    });

    it('generates monotonically decreasing ramp for ducking / fade-out', () => {
      const ramp = calculateTransitionRamp(1.0, 0.2, 6, 's-curve');
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i]).toBeLessThanOrEqual(ramp[i - 1]);
      }
      expect(ramp[0]).toBe(1.0);
      expect(ramp[ramp.length - 1]).toBe(0.2);
    });

    it('supports linear ramp mode', () => {
      const ramp = calculateTransitionRamp(0.0, 1.0, 5, 'linear');
      expect(ramp).toEqual([0.0, 0.25, 0.5, 0.75, 1.0]);
    });

    it('handles single step gracefully', () => {
      const ramp = calculateTransitionRamp(0.2, 0.9, 1);
      expect(ramp).toEqual([0.9]);
    });
  });

  describe('Audio DSP Service Leveling Integration', () => {
    it('returns calibrated volume 1.0 for live radio channels', () => {
      const volume = audioDspService.getNormalizedVolume({
        id: 'radiotedu-main',
        isLiveStream: true,
      });
      expect(volume).toBe(1.0);
    });

    it('normalizes podcast tracks to broadcast baseline to prevent loud volume jumps', () => {
      const volume = audioDspService.getNormalizedVolume({
        id: 'podcast:ep123',
        isLiveStream: false,
      });
      // Default podcast attenuation (-2 dB ~ 0.79) to align hotter podcast masters with live stream
      expect(volume).toBeCloseTo(0.79, 1);
      expect(volume).toBeLessThan(1.0);
    });

    it('levels podcast with known loud metadata (-12 LUFS) down to target (-16 LUFS)', () => {
      const volume = audioDspService.getNormalizedVolume({
        id: 'podcast:loud_commercial',
        isLiveStream: false,
        lufs: -12.0,
      });
      // -12 LUFS to -16 LUFS is -4 dB -> ~0.631 multiplier
      expect(volume).toBeCloseTo(0.63, 1);
    });

    it('returns unity 1.0 when DSP leveling is disabled by user preference', async () => {
      await audioDspService.setLevelingEnabled(false);
      expect(audioDspService.isLevelingEnabled()).toBe(false);

      const podcastVol = audioDspService.getNormalizedVolume({
        id: 'podcast:ep123',
        isLiveStream: false,
        lufs: -10.0,
      });
      expect(podcastVol).toBe(1.0);
    });

    it('exposes DSP leveling toggle through playbackQueue', async () => {
      expect(isAudioDspLeveling()).toBe(true);

      await setAudioDspLeveling(false);
      expect(isAudioDspLeveling()).toBe(false);

      await setAudioDspLeveling(true);
      expect(isAudioDspLeveling()).toBe(true);
    });

    it('applies smooth multi-step volume ramp to a setVolume callback', async () => {
      const volumeCalls: number[] = [];
      const setVolumeMock = jest.fn(async (v: number) => {
        volumeCalls.push(v);
      });

      await audioDspService.applySmoothVolumeRamp(setVolumeMock, 0.8, 0.2, 80);

      expect(setVolumeMock).toHaveBeenCalled();
      expect(volumeCalls.length).toBeGreaterThanOrEqual(4);
      expect(volumeCalls[0]).toBe(0.2);
      expect(volumeCalls[volumeCalls.length - 1]).toBe(0.8);
    });
  });
});
