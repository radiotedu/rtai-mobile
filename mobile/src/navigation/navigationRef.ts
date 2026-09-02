import {createNavigationContainerRef} from '@react-navigation/native';

export const navigationRef =
  typeof createNavigationContainerRef === 'function'
    ? createNavigationContainerRef<any>()
    : ({
        isReady: () => false,
        navigate: () => {},
        getCurrentRoute: () => undefined,
        getRootState: () => ({routes: [], index: 0}),
        canGoBack: () => false,
        goBack: () => {},
      } as any);

export function openPlayerModal(stationId?: string) {
  if (navigationRef && typeof navigationRef.isReady === 'function' && navigationRef.isReady()) {
    navigationRef.navigate('Player', stationId ? {stationId} : undefined);
  }
}
