import React, {createContext, useCallback, useContext, useRef, useState, ReactNode} from 'react';
import TrackPlayer, {Event, useTrackPlayerEvents} from 'react-native-track-player';
import {RADIO_CHANNELS, shouldUseStationOnlyPresentation} from '../data/radioChannels';
import {fetchAlbumArtwork} from '../utils/api';
import {parseTrackPlayerMetadataEvent} from '../services/streamMetadata';

interface TrackMetadata {
  title: string;
  artist: string;
  artwork: string;
}

interface MetadataContextType {
  metadata: TrackMetadata | null;
  updateMetadata: (data: TrackMetadata) => void;
  clearMetadata: () => void;
}

const MetadataContext = createContext<MetadataContextType | undefined>(
  undefined,
);

export const MetadataProvider = ({ children }: { children: ReactNode }) => {
  const [metadata, setMetadata] = useState<TrackMetadata | null>(null);
  const lastMetadataKey = useRef('');

  const updateMetadata = useCallback((data: TrackMetadata) => {
    setMetadata(data);
  }, []);

  const clearMetadata = useCallback(() => {
    lastMetadataKey.current = '';
    setMetadata(null);
  }, []);

  useTrackPlayerEvents(
    [
      Event.PlaybackActiveTrackChanged,
      Event.PlaybackMetadataReceived,
      Event.MetadataTimedReceived,
      Event.MetadataCommonReceived,
    ],
    async event => {
      if (event.type === Event.PlaybackActiveTrackChanged) {
        clearMetadata();
        return;
      }

      const parsed = parseTrackPlayerMetadataEvent(event as Record<string, any>);
      if (!parsed) {
        return;
      }
      const track = await TrackPlayer.getActiveTrack();
      if (!track?.id) {
        return;
      }
      const channel = RADIO_CHANNELS.find(item => item.id === String(track.id));
      if (shouldUseStationOnlyPresentation(channel, (track as any).streamQuality)) {
        clearMetadata();
        return;
      }
      const artist = parsed.artist || channel?.name || 'RadioTEDU';
      const key = `${String(track.id)}:${artist}:${parsed.title}`;
      if (key === lastMetadataKey.current) {
        return;
      }
      lastMetadataKey.current = key;

      const fallbackArtwork = String(
        track.artwork || channel?.artwork || 'https://radiotedu.com/logo.png',
      );
      const immediate = {
        title: parsed.title,
        artist,
        artwork: parsed.artwork || fallbackArtwork,
      };
      // Update the app, lock screen and notification immediately with clean fallback/parsed artwork.
      updateMetadata(immediate);
      const index = await TrackPlayer.getActiveTrackIndex();
      if (index !== undefined) {
        await TrackPlayer.updateMetadataForTrack(index, immediate);
      }

      if (parsed.artwork || parsed.isJingle) {
        return;
      }
      const fetchedArtwork = await fetchAlbumArtwork(`${artist} ${parsed.title}`);
      if (!fetchedArtwork || key !== lastMetadataKey.current) {
        return;
      }
      const activeAfterFetch = await TrackPlayer.getActiveTrack();
      if (String(activeAfterFetch?.id ?? '') !== String(track.id)) {
        return;
      }
      const enriched = {...immediate, artwork: fetchedArtwork};
      updateMetadata(enriched);
      const activeIndex = await TrackPlayer.getActiveTrackIndex();
      if (activeIndex !== undefined) {
        await TrackPlayer.updateMetadataForTrack(activeIndex, enriched);
      }
    },
  );

  return (
    <MetadataContext.Provider
      value={{
        metadata,
        updateMetadata,
        clearMetadata,
      }}>
      {children}
    </MetadataContext.Provider>
  );
};

export const useMetadata = () => {
  const context = useContext(MetadataContext);
  if (!context) {
    throw new Error('useMetadata must be used within a MetadataProvider');
  }
  return context;
};

export default MetadataContext;
