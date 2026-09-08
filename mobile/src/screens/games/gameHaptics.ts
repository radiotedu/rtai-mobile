import {getGamePreferences} from '../../services/gamePreferences';
import {Vibration} from 'react-native';

/**
 * Calibrated micro-haptics for RadioTEDU arcade games.
 * Provides crisp, responsive tactile feedback for arcade interactions.
 */
export const GameHaptics = {
  /** Crisp micro-tap for buttons, d-pad presses, card flips (12ms) */
  tap: () => {
    if (!getGamePreferences().haptics) {return;}
    try {
      Vibration.vibrate(12);
    } catch {
      // Ignored on devices without vibrator hardware
    }
  },

  /** Satisfying pulse for positive events: food eaten, card match, correct quiz answer, line clear */
  success: () => {
    if (!getGamePreferences().haptics) {return;}
    try {
      Vibration.vibrate([0, 15, 35, 20]);
    } catch {}
  },

  /** Escalating pulse for streaks and combos */
  combo: (multiplier: number = 2) => {
    if (!getGamePreferences().haptics) {return;}
    try {
      if (multiplier >= 5) {
        Vibration.vibrate([0, 15, 25, 20, 25, 30]);
      } else {
        Vibration.vibrate([0, 15, 30, 25]);
      }
    } catch {}
  },

  /** Solid impact for Tetris hard drop or collision */
  impact: () => {
    if (!getGamePreferences().haptics) {return;}
    try {
      Vibration.vibrate(22);
    } catch {}
  },

  /** Warning alert on life loss or wrong answer */
  warning: () => {
    if (!getGamePreferences().haptics) {return;}
    try {
      Vibration.vibrate([0, 40, 50, 40]);
    } catch {}
  },

  /** End-of-round completion feedback */
  gameOver: () => {
    if (!getGamePreferences().haptics) {return;}
    try {
      Vibration.vibrate([0, 50, 60, 40]);
    } catch {}
  },
};
