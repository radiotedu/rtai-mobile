import AsyncStorage from '@react-native-async-storage/async-storage';
import {PodcastTimecapsuleService} from '../services/podcastTimecapsuleService';
const entry = {podcastId: 'episode-a', timestampSeconds: 65, authorName: 'Listener', text: 'My note', category: 'exam_tip' as const};
describe('persistent episode notes', () => {
  beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });
  it('starts empty and does not inject demo notes into real episodes', async () => {
    const service = new PodcastTimecapsuleService(); await service.initialize();
    expect(service.getTimecapsules('episode-a')).toEqual([]);
  });
  it('restores saved notes and likes after restart without cross-episode leakage', async () => {
    const service = new PodcastTimecapsuleService();
    const note = await service.addTimecapsule(entry);
    await service.likeTimecapsule(note.id);
    const restarted = new PodcastTimecapsuleService(); await restarted.initialize();
    expect(restarted.getTimecapsules('episode-a')[0]).toMatchObject({...entry, likes: 2});
    expect(restarted.getTimecapsules('episode-b')).toEqual([]);
    expect(restarted.getTimecapsulesAtTime(70, 'episode-a', 10)).toHaveLength(1);
  });
  it('serializes writes made while loading', async () => {
    const service = new PodcastTimecapsuleService();
    await Promise.all([service.addTimecapsule(entry), service.addTimecapsule({...entry, text: 'second'})]);
    const restarted = new PodcastTimecapsuleService(); await restarted.initialize();
    expect(restarted.getTimecapsules('episode-a')).toHaveLength(2);
  });
  it('reports failed writes without claiming a note was saved, then allows retry', async () => {
    const service = new PodcastTimecapsuleService();
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(service.addTimecapsule(entry)).rejects.toThrow('disk full');
    expect(service.getTimecapsules()).toEqual([]);
    await service.addTimecapsule(entry);
    expect(service.getTimecapsules()).toHaveLength(1);
  });
  it('does not overwrite corrupt storage', async () => {
    await AsyncStorage.setItem('radiotedu.podcast.timecapsules.v1', '{broken');
    const service = new PodcastTimecapsuleService();
    await expect(service.addTimecapsule(entry)).rejects.toThrow();
    expect(await AsyncStorage.getItem('radiotedu.podcast.timecapsules.v1')).toBe('{broken');
  });
});
