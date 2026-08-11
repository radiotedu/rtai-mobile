import {useCallback, useEffect, useState} from 'react';
import {
  DEFAULT_STREAM_PREFERENCES,
  loadStreamPreferences,
  saveStreamPreferences,
  StreamPreferences,
  subscribeStreamPreferences,
} from '../services/streamPreferences';

export function useStreamPreferences() {
  const [preferences, setPreferencesState] = useState<StreamPreferences>(
    DEFAULT_STREAM_PREFERENCES,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeStreamPreferences(next => {
      if (active) {
        setPreferencesState(next);
      }
    });

    loadStreamPreferences()
      .then(next => {
        if (active) {
          setPreferencesState(next);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const setPreferences = useCallback(async (next: StreamPreferences) => {
    const saved = await saveStreamPreferences(next);
    setPreferencesState(saved);
    return saved;
  }, []);

  return {
    preferences,
    setPreferences,
    isLoading,
  };
}
