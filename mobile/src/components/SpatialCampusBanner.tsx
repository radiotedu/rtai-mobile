import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  CampusZone,
  dismissCurrentCampusZone,
  getActiveCampusZone,
  subscribeToCampusZone,
} from '../services/campusSpatialService';
import {playTrackById} from '../services/playbackQueue';
import {logSafeError} from '../utils/safeLog';
import {Analytics} from '../services/analyticsService';

interface SpatialCampusBannerProps {
  onActivateZone?: (zone: CampusZone) => void;
  testID?: string;
}

export const SpatialCampusBanner: React.FC<SpatialCampusBannerProps> = ({
  onActivateZone,
  testID = 'spatial-campus-banner',
}) => {
  const [activeZone, setActiveZone] = useState<CampusZone | null>(getActiveCampusZone());
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsub = subscribeToCampusZone(zone => {
      setActiveZone(zone);
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (activeZone) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      if (process.env.NODE_ENV !== 'test') {
        const pulseLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.12,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1.0,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
        );
        pulseLoop.start();
        return () => pulseLoop.stop();
      }
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -80,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [activeZone]);

  if (!activeZone) {
    return null;
  }

  const handleActivate = async () => {
    try {
      if (onActivateZone) {
        onActivateZone(activeZone);
      }
      await playTrackById(activeZone.recommendedChannelId);
      dismissCurrentCampusZone();
    } catch (err) {
      logSafeError('spatialBanner.activate', err);
    }
  };

  const handleDismiss = () => {
    dismissCurrentCampusZone();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          borderColor: `${activeZone.accentColor}50`,
          opacity: opacityAnim,
          transform: [{translateY: slideAnim}],
        },
      ]}
      testID={testID}>
      {/* Dynamic Zone Ambient Halo */}
      <View
        style={[
          styles.accentGlow,
          {backgroundColor: `${activeZone.accentColor}18`},
        ]}
      />

      <View style={styles.contentRow}>
        {/* Animated Zone Beacon Icon */}
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: `${activeZone.accentColor}25`,
              borderColor: activeZone.accentColor,
              transform: [{scale: pulseAnim}],
            },
          ]}>
          <Icon name={activeZone.icon} size={20} color={activeZone.accentColor} />
        </Animated.View>

        {/* Text Details */}
        <View style={styles.textWrap}>
          <View style={styles.badgeRow}>
            <View
              style={[styles.liveDot, {backgroundColor: activeZone.accentColor}]}
            />
            <Text style={[styles.zoneBadgeText, {color: activeZone.accentColor}]}>
              KAMPÜS MEKANSAL SES
            </Text>
          </View>
          <Text style={styles.zoneTitle} numberOfLines={1}>
            {activeZone.promptTitle}
          </Text>
          <Text style={styles.zoneSub} numberOfLines={1}>
            {activeZone.promptDescription}
          </Text>
        </View>

        {/* Action Button: Start Mode */}
        <TouchableOpacity
          style={[styles.activateBtn, {backgroundColor: activeZone.accentColor}]}
          onPress={handleActivate}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={activeZone.promptTitle}
          testID="spatial-banner-activate-btn">
          <Icon name="play" size={14} color="#ffffff" />
          <Text style={styles.activateBtnText}>Başlat</Text>
        </TouchableOpacity>

        {/* Dismiss Button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          testID="spatial-banner-dismiss-btn">
          <Icon name="close" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#0c0f17',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  accentGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 120,
    height: 80,
    borderRadius: 40,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  textWrap: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zoneBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  zoneTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  zoneSub: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  activateBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});

export default SpatialCampusBanner;
