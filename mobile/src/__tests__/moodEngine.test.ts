import {
  activateMood,
  clearActiveMood,
  getActiveMood,
  getAvailableMoodProfiles,
  subscribeToMoodChanges,
} from '../services/moodEngineService';
import {audioDspService} from '../services/audioDspService';
import {playTrackById} from '../services/playbackQueue';

jest.mock('../services/playbackQueue', () => ({
  playTrackById: jest.fn().mockResolvedValue(true),
  pausePlaybackByUser: jest.fn().mockResolvedValue(undefined),
  resumePlaybackByUser: jest.fn().mockResolvedValue(undefined),
}));

describe('Smart Mood Flow Engine Service', () => {
  beforeEach(() => {
    clearActiveMood();
    jest.clearAllMocks();
  });

  it('returns all defined mood profiles', () => {
    const profiles = getAvailableMoodProfiles();
    expect(profiles.length).toBe(4);
    const ids = profiles.map(p => p.id);
    expect(ids).toContain('exam_focus');
    expect(ids).toContain('campus_walk');
    expect(ids).toContain('night_chill');
    expect(ids).toContain('campus_gym');
  });

  it('activates mood, sets DSP and switches channel', async () => {
    expect(getActiveMood()).toBeNull();

    const activated = await activateMood('exam_focus');
    expect(activated).not.toBeNull();
    expect(activated?.id).toBe('exam_focus');
    expect(activated?.recommendedStationId).toBe('radiotedu-lofi');
    expect(getActiveMood()?.id).toBe('exam_focus');

    expect(audioDspService.isLevelingEnabled()).toBe(true);
    expect(audioDspService.getTargetLufs()).toBe(-16.0);
    expect(playTrackById).toHaveBeenCalledWith('radiotedu-lofi');
  });

  it('supports listener subscriptions', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToMoodChanges(listener);

    expect(listener).toHaveBeenCalledWith(null);

    await activateMood('campus_gym');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({id: 'campus_gym'}),
    );

    clearActiveMood();
    expect(listener).toHaveBeenCalledWith(null);

    unsubscribe();
    await activateMood('night_chill');
    // listener should not receive further calls after unsubscribe
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('returns null when activating non-existent mood', async () => {
    const result = await activateMood('invalid_mood');
    expect(result).toBeNull();
    expect(getActiveMood()).toBeNull();
  });
});
