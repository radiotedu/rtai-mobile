import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import {AppState} from 'react-native';
import {
  buildVisibleChannels,
  channelsVisibleWithoutLiveCheck,
  RADIO_CHANNELS,
  RadioChannel,
  setRuntimeVisibleChannels,
} from '../data/radioChannels';
import {checkStreamAvailability} from '../utils/api';

interface ChannelContextType {
  activeChannels: RadioChannel[];
  isChecking: boolean;
  hasChecked: boolean;
  refreshChannels: () => Promise<void>;
}

const ChannelContext = createContext<ChannelContextType | undefined>(undefined);

export const ChannelProvider: React.FC<{children: ReactNode}> = ({
  children,
}) => {
  const [activeChannels, setActiveChannels] =
    useState<RadioChannel[]>(channelsVisibleWithoutLiveCheck());
  const [isChecking, setIsChecking] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);

  const checkAllStreams = async () => {
    setIsChecking(true);
    // Minimum load time for UX consistency (optional, can be removed if speed is preferred)
    const minimumLoadTime = new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const [_, checks] = await Promise.all([
        minimumLoadTime,
        Promise.all(
          RADIO_CHANNELS.map(async channel => {
            const isAvailable = await checkStreamAvailability(
              channel.streamUrl,
            );
            return {channel, isAvailable};
          }),
        ),
      ]);

      const active = buildVisibleChannels(checks);
      console.log(
        `[ChannelContext] Active Channels Found: ${active.length} / ${RADIO_CHANNELS.length}`,
      );

      if (active.length === 0) {
        console.log(
          '[ChannelContext] No active channels found. Fallback to all.',
        );
        const fallback = channelsVisibleWithoutLiveCheck();
        setRuntimeVisibleChannels(fallback);
        setActiveChannels(fallback);
      } else {
        setRuntimeVisibleChannels(active);
        setActiveChannels(active);
      }
    } catch (error) {
      console.error('[ChannelContext] Error checking streams:', error);
      const fallback = channelsVisibleWithoutLiveCheck();
      setRuntimeVisibleChannels(fallback);
      setActiveChannels(fallback);
    } finally {
      setIsChecking(false);
      setHasChecked(true);
    }
  };

  useEffect(() => {
    checkAllStreams();
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkAllStreams();
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <ChannelContext.Provider
      value={{
        activeChannels,
        isChecking,
        hasChecked,
        refreshChannels: checkAllStreams,
      }}>
      {children}
    </ChannelContext.Provider>
  );
};

export const useChannels = () => {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error('useChannels must be used within a ChannelProvider');
  }
  return context;
};
