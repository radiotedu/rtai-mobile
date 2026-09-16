# iOS 18 Live Activities, Dynamic Island & App Intents Specification

## Overview

This document specifies the iOS 18 ActivityKit, Dynamic Island, and App Intents integration for RadioTEDU Mobile (`com.radiotedumobile`).

The implementation is located in:
- Bridge service: `mobile/src/services/LiveActivityBridge.ts`
- Unit test suite: `mobile/src/__tests__/liveActivityBridge.test.ts`
- Native App Intents metadata: `mobile/ios/RadioTEDUMobile/RadioTEDUAppIntents.swift`

---

## 1. Dynamic Island Architecture

Dynamic Island expands on iPhone 14 Pro, iPhone 15, iPhone 15 Pro, iPhone 16, and later devices running iOS 16.1 through iOS 18+.

```text
┌─────────────────────────────────────────────────────────────┐
│                       DYNAMIC ISLAND                        │
├──────────────────────────────┬──────────────────────────────┤
│ Compact Leading              │ Compact Trailing             │
│ [Station Icon / Waveform]    │ [RadioTEDU Gold Badge 🪙42]  │
├──────────────────────────────┴──────────────────────────────┤
│ Expanded Top                                                │
│ [Station Logo + LIVE Badge]    [Stream Quality FLAC / AAC]  │
│                                                             │
│ Expanded Center                                             │
│ Now Playing Title (Marquee) - Artist                        │
│ [ ▂ ▃ ▅ ▆ ▇ ▆ ▅ ▃ ▂ ]  Real-time 5-band audio wave visualizer│
│                                                             │
│ Expanded Bottom                                             │
│ [⏮ Prev Station]  [▶/⏸ Play/Pause]  [⏭ Next]  [❤️ Favorite] │
└─────────────────────────────────────────────────────────────┘
```

### Layout Specifications
1. **Compact Leading**: Station monogram / animated mini-waveform tinted with station brand color:
   - RadioTEDU: `#E31E24`
   - Classical: `#E5A000`
   - Jazz: `#9C27B0`
   - Lo-Fi: `#00BCD4`
   - Energize: `#F36F21`
   - Rock: `#FF6B2C`
2. **Compact Trailing**: RadioTEDU Gold badge counter (`🪙 120`) indicating active listening reward status.
3. **Minimal**: Circular waveform indicator displayed when multitasking with another Live Activity.
4. **Expanded**: Full station artwork, title marquee, real-time 5-band audio wave visualizer, quality badge (`FLAC`, `AAC`), and interactive App Intent buttons.

---

## 2. ActivityKit ContentState & Data Attributes

```typescript
export interface LiveActivityAttributes {
  activityId: string;
  stationId: string;      // e.g. 'radiotedu-jazz'
  stationName: string;    // e.g. 'RadioTEDU Jazz'
  stationColor: string;   // e.g. '#9C27B0'
  streamMount: string;    // e.g. '/cazz'
  startedAt: number;      // Unix timestamp (ms)
}

export interface LiveActivityContentState {
  title: string;
  artist: string;
  isPlaying: boolean;
  isLive: boolean;
  quality: 'low' | 'normal' | 'high' | 'flac';
  goldBalance: number;
  goldListeningActive: boolean;
  waveVisualizer: {
    amplitudes: [number, number, number, number, number]; // 0.0 to 1.0
    isActive: boolean;
    mode: 'bars' | 'wave' | 'pulse';
  };
  artworkUri?: string;
  hasLyrics?: boolean;
  updatedAt: number;
}
```

---

## 3. iOS 18 App Intents Specification

App Intents enable deep system integration with Siri Shortcuts, Spotlight Search, Action Button, Control Center, and interactive widgets.

### 1) `PlayRadioTEDUIntent`
- **Title**: Play RadioTEDU Station
- **Description**: Plays a selected live RadioTEDU broadcast station.
- **Parameters**: `station` (Enum: `radiotedu-main`, `radiotedu-classic`, `radiotedu-jazz`, `radiotedu-lofi`, `radiotedu-energize`, `radiotedu-rock`).
- **Siri Phrases (English)**:
  - *"Hey Siri, play RadioTEDU"*
  - *"Hey Siri, play RadioTEDU Jazz"*
  - *"Hey Siri, play RadioTEDU Classical"*
  - *"Hey Siri, play RadioTEDU Lo-Fi"*
  - *"Hey Siri, play RadioTEDU Energize"*
  - *"Hey Siri, play RadioTEDU Rock"*
- **Siri Phrases (Turkish)**:
  - *"Hey Siri, RadioTEDU aç"*
  - *"Hey Siri, RadioTEDU çal"*
  - *"Hey Siri, RadioTEDU Jazz çal"*
  - *"Hey Siri, RadioTEDU Klasik dinle"*
  - *"Hey Siri, RadioTEDU Lo-Fi aç"*
  - *"Hey Siri, RadioTEDU Rock çal"*

### 2) `TogglePlaybackIntent`
- **Title**: Toggle RadioTEDU Playback
- **Description**: Pauses or resumes the active stream.
- **Siri Phrases**: *"Pause RadioTEDU"*, *"Resume RadioTEDU"*, *"RadioTEDU durdur"*, *"RadioTEDU devam et"*.
- **Controls**: Dynamic Island tap, Lock Screen widget, iOS 18 Control Center button.

### 3) `SkipStationIntent`
- **Title**: Next RadioTEDU Station
- **Description**: Cycles sequentially through the 6 canonical stations.

### 4) `ToggleFavoriteIntent`
- **Title**: Favorite Current Track
- **Description**: Adds or removes currently playing song to/from RadioTEDU favorites.

### 5) `CheckGoldBalanceIntent`
- **Title**: Check RadioTEDU Gold
- **Description**: Speaks or displays verified RadioTEDU Gold balance and earning rate.
- **Siri Phrases**: *"Check my RadioTEDU Gold"*, *"RadioTEDU altınımı göster"*.

---

## 4. iOS 18 Control Center Widgets

Under iOS 18, Control Center widgets use the new `ControlWidget` protocol:

1. **RadioTEDU Play/Pause Widget** (`com.radiotedu.control.playpause`):
   - Type: `toggle`
   - Intent: `TogglePlaybackIntent`
   - Tint Color: `#E31E24`
   - Action: 1-tap instant pause/resume without opening full app window.

2. **RadioTEDU Station Picker Widget** (`com.radiotedu.control.stationpicker`):
   - Type: `menu`
   - Intent: `PlayRadioTEDUIntent`
   - Tint Color: `#E5A000`
   - Action: Opens quick-selection menu of the 6 canonical live stations.

3. **RadioTEDU Gold Tracker Widget** (`com.radiotedu.control.goldtracker`):
   - Type: `button`
   - Intent: `CheckGoldBalanceIntent`
   - Tint Color: `#FFD700`
   - Action: Displays current Gold count and listening heartbeat status.

---

## 5. Non-iOS & Safety Fallback Guarantee

Every method in `LiveActivityBridge.ts` checks:
1. `Platform.OS === 'ios'`
2. `NativeModules.RadioTeduLiveActivityBridge != null`
3. Comprehensive `try / catch` wraps around all native module invocations.

On Android, mobile web, or headless environments:
- No native module exceptions are thrown.
- Calls safely resolve to fallback values (`false`, `null`, `0`).
- Jest test suite guarantees 100% pass rate across Android mock platforms, missing native modules, and throwing native modules.
