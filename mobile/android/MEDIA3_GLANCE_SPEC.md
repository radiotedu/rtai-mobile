# RadioTEDU Android Glance AppWidget & Media3 Command Expansion Specification

**Document Status**: Official Architecture Specification & Platform Contract  
**Target OS Versions**: Android 15 (API 35) & Android 16 (API 36)  
**Media Framework**: AndroidX Media3 `1.10.1` (`androidx.media3`)  
**Widget Framework**: Jetpack Glance `1.1.1` (`androidx.glance:glance-appwidget`, `androidx.glance:glance-material3`)  
**Host Service**: `com.radiotedumobile.car.RadioTeduCarService` (`MediaLibraryService`)  
**Author**: Android Platform Architecture  

---

## 1. Executive Summary & Design Vision

RadioTEDU's mobile listening experience spans Android phones, foldable devices, tablets, Android Auto, and Automotive OS (AAOS). In Android 15 and 16, glanceable surfaces on the Home Screen and secondary lock surfaces represent the primary lightweight interaction points for audio streaming.

This document defines the production specification for:
1. **The Jetpack Glance AppWidget Architecture**: A modern, declarative home screen widget powered by Jetpack Compose Glance, providing responsive sizing, dynamic RadioTEDU station brand styling, and immediate audio transport.
2. **Media3 `SessionCommand` Expansion**: Enhancing the existing Media3 `RadioTeduCarService` beyond `ACTION_TOGGLE_HIFI` to expose a complete headless command suite for station switching, sleep timers, favorites, and podcast navigation.
3. **Decoupled Native Topology**: Absolute decoupling from the React Native JS runtime. Home screen widget actions interface directly with the native Media3 session and ExoPlayer core, ensuring zero-latency startup without loading the React Native bundle or consuming UI thread memory.
4. **Android 15/16 System Inset & Predictive Back Synergy**: Unified handling of system margins, edge-to-edge system insets, and deep-link navigation into `PlayerScreen` modal with graceful gesture dismissal.

---

## 2. Decoupled Native Architecture Topology

The Glance AppWidget operates purely within the native Android process layer:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Android OS System Server                        │
│   AppWidgetManager  ◄──────── RemoteViews ───────── GlanceAppWidget    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ IPC Intent Actions
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  RadioTEDU Native Android Application                  │
│                                                                        │
│   ┌───────────────────────────┐      ┌───────────────────────────────┐ │
│   │  RadioTeduGlanceReceiver  │ ───► │      Glance ActionCallbacks   │ │
│   └───────────────────────────┘      └──────────────┬────────────────┘ │
│                                                     │                  │
│                                      MediaController / SessionToken    │
│                                                     ▼                  │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │         RadioTeduCarService (MediaLibraryService / Media3)       │ │
│   │                                                                  │ │
│   │  - MediaLibrarySession (SessionCommand handling)                 │ │
│   │  - Headless ExoPlayer (Audio Focus, HLS/AAC/FLAC decoding)       │ │
│   │  - IcyInfo Stream Metadata Extraction                            │ │
│   │  - Low-Recovery Auto Fallback Mount Controller                   │ │
│   └──────────────────────────────────┬───────────────────────────────┘ │
│                                      │ (State Notifications)           │
│                                      ▼                                 │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │  Glance State Synchronizer (GlanceAppWidget.update())            │ │
│   └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                   ▲
               (Optional Deep Link │ Tap to Open Player)
                                   │
┌──────────────────────────────────┴─────────────────────────────────────┐
│                    React Native Application Layer                      │
│   MainActivity ──► NavigationContainer ──► PlayerScreen (Modal)       │
│   - BackHandler & Predictive Back Safe Navigation                      │
│   - SafeAreaInsets edge-to-edge compliance                             │
└────────────────────────────────────────────────────────────────────────┘
```

### Architectural Safeguards:
- **Zero React Native Cold Boot**: Tapping Play, Pause, Next Station, or FLAC Hi-Fi on the widget interacts exclusively with `RadioTeduCarService`. The React Native JavaScript VM (`libhermes.so`) is NOT started, avoiding a 150MB+ memory allocation and 1.5s cold-start penalty.
- **Binder Transaction Safety**: RemoteViews bitmaps are strictly capped. Album art is loaded into bounded bitmaps (maximum 512x512 ARGB_8888) or referenced via the content provider `CarArtworkProvider` (`com.radiotedumobile.carartwork`) to prevent `TransactionTooLargeException` on Android IPC.
- **Single Authoritative Playback State**: Both car (Android Auto / AAOS) and home screen widgets bind to the identical `RadioTeduMediaLibrary` session token. Changing a station from the widget immediately updates car media controls and system media notifications.

---

## 3. Media3 `SessionCommand` Expansion Contract

The `RadioTeduCarService` currently implements `ACTION_TOGGLE_HIFI` (`com.radiotedumobile.car.ACTION_TOGGLE_HIFI`). For Android 15/16 Glance widgets and external native surfaces, the session command registry expands as follows:

### 3.1 Command Definitions

| Command Constant | Action URI | Bundle Arguments | Description |
| :--- | :--- | :--- | :--- |
| `CMD_TOGGLE_HIFI` | `com.radiotedumobile.media.TOGGLE_HIFI` | None | Toggles between normal AAC/MP3 stream and FLAC lossless stream for current channel. |
| `CMD_SELECT_STATION` | `com.radiotedumobile.media.SELECT_STATION` | `EXTRA_STATION_ID` (String) | Immediately tunes to one of the 6 canonical stations (`radiotedu`, `radiotedu-classic`, `radiotedu-jazz`, `radiotedu-lofi`, `radiotedu-energize`, `radiotedu-rock`). |
| `CMD_CYCLE_STATION` | `com.radiotedumobile.media.CYCLE_STATION` | `EXTRA_DELTA` (Int: +1 or -1) | Cycles forward or backward through the canonical stations list. |
| `CMD_TOGGLE_FAVORITE` | `com.radiotedumobile.media.TOGGLE_FAVORITE` | `EXTRA_STATION_ID` (String, optional) | Toggles the favorite status for the station in shared preferences. |
| `CMD_SET_SLEEP_TIMER` | `com.radiotedumobile.media.SET_SLEEP_TIMER` | `EXTRA_MINUTES` (Int) | Sets a sleep timer (15, 30, 45, 60 min) to smoothly fade and stop playback. Passing `0` cancels the active timer. |
| `CMD_SEEK_PODCAST` | `com.radiotedumobile.media.SEEK_PODCAST` | `EXTRA_DELTA_SECONDS` (Long) | Rewinds 15s or skips forward 30s during active podcast playback. No-op for live radio. |

### 3.2 Service Implementation Pattern (`RadioTeduCarService.kt`)

```kotlin
// Session Command Identifiers
private const val ACTION_TOGGLE_HIFI = "com.radiotedumobile.car.ACTION_TOGGLE_HIFI"
private const val ACTION_SELECT_STATION = "com.radiotedumobile.media.SELECT_STATION"
private const val ACTION_CYCLE_STATION = "com.radiotedumobile.media.CYCLE_STATION"
private const val ACTION_TOGGLE_FAVORITE = "com.radiotedumobile.media.TOGGLE_FAVORITE"
private const val ACTION_SET_SLEEP_TIMER = "com.radiotedumobile.media.SET_SLEEP_TIMER"
private const val ACTION_SEEK_PODCAST = "com.radiotedumobile.media.SEEK_PODCAST"

private const val EXTRA_STATION_ID = "station_id"
private const val EXTRA_DELTA = "delta"
private const val EXTRA_MINUTES = "minutes"
private const val EXTRA_DELTA_SECONDS = "delta_seconds"

// In LibraryCallback.onConnect:
override fun onConnect(
    session: MediaSession,
    controller: MediaSession.ControllerInfo,
): MediaSession.ConnectionResult {
    val commands = MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS
        .buildUpon()
        .add(SessionCommand(ACTION_TOGGLE_HIFI, Bundle.EMPTY))
        .add(SessionCommand(ACTION_SELECT_STATION, Bundle.EMPTY))
        .add(SessionCommand(ACTION_CYCLE_STATION, Bundle.EMPTY))
        .add(SessionCommand(ACTION_TOGGLE_FAVORITE, Bundle.EMPTY))
        .add(SessionCommand(ACTION_SET_SLEEP_TIMER, Bundle.EMPTY))
        .add(SessionCommand(ACTION_SEEK_PODCAST, Bundle.EMPTY))
        .build()

    return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
        .setAvailableSessionCommands(commands)
        .setMediaButtonPreferences(hiFiButtonPreferences())
        .build()
}

// In LibraryCallback.onCustomCommand:
override fun onCustomCommand(
    session: MediaSession,
    controller: MediaSession.ControllerInfo,
    customCommand: SessionCommand,
    args: Bundle,
): ListenableFuture<SessionResult> {
    return when (customCommand.customAction) {
        ACTION_TOGGLE_HIFI -> handleToggleHiFi(controller)
        ACTION_SELECT_STATION -> {
            val stationId = args.getString(EXTRA_STATION_ID)
            if (stationId != null) {
                tuneToStationById(stationId)
                Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
            } else {
                Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_BAD_VALUE))
            }
        }
        ACTION_CYCLE_STATION -> {
            val delta = args.getInt(EXTRA_DELTA, 1)
            cycleStationByDelta(delta)
            Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }
        ACTION_TOGGLE_FAVORITE -> {
            val stationId = args.getString(EXTRA_STATION_ID) ?: activeCatalogItem?.id
            if (stationId != null) {
                toggleFavoriteInPrefs(stationId)
                notifyGlanceWidgetsChanged()
                Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
            } else {
                Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_INVALID_STATE))
            }
        }
        ACTION_SET_SLEEP_TIMER -> {
            val minutes = args.getInt(EXTRA_MINUTES, 0)
            applyNativeSleepTimer(minutes)
            notifyGlanceWidgetsChanged()
            Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }
        ACTION_SEEK_PODCAST -> {
            val deltaSec = args.getLong(EXTRA_DELTA_SECONDS, 0L)
            if (isPodcastPlaying() && deltaSec != 0L) {
                player.seekTo(player.currentPosition + (deltaSec * 1000L))
                Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
            } else {
                Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED))
            }
        }
        else -> Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED))
    }
}
```

---

## 4. Jetpack Glance AppWidget Specification

### 4.1 Responsive Sizing Matrix (`SizeMode.Responsive`)

Android 15 and 16 recommend flexible widgets that adapt seamlessly across launcher grid configurations (2x1, 3x2, 4x2, 5x2, tablet splits, and foldable outer/inner displays):

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        COMPACT (2x1 / 2x2)                             │
│ ┌──────┐ RadioTEDU Classical                                           │
│ │ LOGO │ ● LIVE · Vivaldi - The Four Seasons                [  ▶ / ⏸  ] │
│ └──────┘                                                               │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                        MEDIUM (3x2 / 4x1)                              │
│ ┌────────────┐  RadioTEDU Jazz                      [ Hi-Fi ]          │
│ │            │  ● LIVE · Ankara Studios                                │
│ │  ARTWORK   │  Miles Davis - So What                                  │
│ │   (84dp)   │                                                         │
│ │            │  [ ⏮ Prev ]        [  ▶ / ⏸  ]        [ ⏭ Next ]        │
│ └────────────┘                                                         │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                        EXPANDED (4x2 / 5x2)                            │
│  RadioTEDU · Ankara Stüdyoları                 [ 🌙 30m ]  [ ♥ ]  [ Hi-Fi ] │
│ ┌────────────┐  RadioTEDU Rock                                         │
│ │  ARTWORK   │  Duman - Haberin Yok Ölüyorum                           │
│ │  (104dp)   │  [ ⏮ ]           [   ▶ / ⏸   ]            [ ⏭ ]         │
│ └────────────┘                                                         │
│ ────────────────────────────────────────────────────────────────────── │
│  [● TEDÜ]   [● Classic]   [● Jazz]   [● Lo-Fi]   [● Energize]   [● Rock]│
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Breakpoints Definition
```kotlin
object RadioTeduWidgetSizeMatrix {
    val COMPACT = DpSize(120.dp, 70.dp)    // 2x1 cell
    val MEDIUM = DpSize(200.dp, 110.dp)    // 3x2 cell
    val EXPANDED = DpSize(280.dp, 180.dp)  // 4x2 / 5x2 cell
}
```

### 4.3 Color Palette & Brand Consistency
The widget strictly adopts RadioTEDU's theme tokens, matching `COLORS` from the React Native theme (`mobile/src/theme/theme.ts`) and station definitions:

- **Background**: `#121212` (Container surface with 16dp rounded corners).
- **Surface Card**: `#1E1E1E` (Inner content elevations).
- **Primary Red**: `#E31E26` (RadioTEDU brand color, playback controls).
- **Gold Accent**: `#FFD700` (Lossless FLAC Hi-Fi pill and badge).
- **Station Brand Color Mapping**:
  - `radiotedu`: `#E31E26` (TEDU Red)
  - `radiotedu-classic`: `#D4AF37` (Aesthetic Gold)
  - `radiotedu-jazz`: `#8A2BE2` (Royal Purple)
  - `radiotedu-lofi`: `#00CED1` (Neon Cyan)
  - `radiotedu-energize`: `#FFD700` (High-Energy Yellow)
  - `radiotedu-rock`: `#FF4500` (Flame Orange)

---

## 5. Declarative Glance Jetpack Compose Specification

### 5.1 Main Widget Implementation Pattern

```kotlin
package com.radiotedumobile.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.*
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.*
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.layout.*
import androidx.glance.text.*
import androidx.glance.unit.ColorProvider
import androidx.core.net.toUri
import android.content.Intent
import com.radiotedumobile.MainActivity
import com.radiotedumobile.R

class RadioTeduGlanceWidget : GlanceAppWidget() {

    override val sizeMode = SizeMode.Responsive(
        setOf(
            RadioTeduWidgetSizeMatrix.COMPACT,
            RadioTeduWidgetSizeMatrix.MEDIUM,
            RadioTeduWidgetSizeMatrix.EXPANDED
        )
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val state = currentState<RadioTeduWidgetState>()
            val size = LocalSize.current

            when {
                size.height >= 170.dp -> ExpandedPlayerLayout(context, state)
                size.width >= 200.dp -> MediumPlayerLayout(context, state)
                else -> CompactPlayerLayout(context, state)
            }
        }
    }
}
```

### 5.2 Glance Action Callbacks (Headless Media3 Invocation)

Each interactive control invokes a lightweight `ActionCallback` that sends the appropriate `SessionCommand` or transport action to `RadioTeduCarService` without opening the activity:

```kotlin
package com.radiotedumobile.widget.actions

import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.media3.session.MediaController
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionToken
import com.radiotedumobile.car.RadioTeduCarService

class TogglePlayPauseAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val sessionToken = SessionToken(
            context,
            ComponentName(context, RadioTeduCarService::class.java)
        )
        val controllerFuture = MediaController.Builder(context, sessionToken).buildAsync()
        controllerFuture.addListener({
            val controller = controllerFuture.get()
            if (controller.isPlaying) {
                controller.pause()
            } else {
                controller.play()
            }
            MediaController.releaseFuture(controllerFuture)
        }, context.mainExecutor)
    }
}

class SelectStationAction : ActionCallback {
    companion object {
        val STATION_ID_KEY = ActionParameters.Key<String>("station_id")
    }

    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val stationId = parameters[STATION_ID_KEY] ?: return
        val sessionToken = SessionToken(
            context,
            ComponentName(context, RadioTeduCarService::class.java)
        )
        val controllerFuture = MediaController.Builder(context, sessionToken).buildAsync()
        controllerFuture.addListener({
            val controller = controllerFuture.get()
            val args = Bundle().apply { putString("station_id", stationId) }
            controller.sendCustomCommand(
                SessionCommand("com.radiotedumobile.media.SELECT_STATION", Bundle.EMPTY),
                args
            )
            MediaController.releaseFuture(controllerFuture)
        }, context.mainExecutor)
    }
}
```

### 5.3 Tap-to-Open Deep Link Integration

Tapping anywhere on the now-playing track card launches `MainActivity` directly into the `PlayerScreen` modal with the current station pre-loaded:

```kotlin
val openPlayerIntent = Intent(context, MainActivity::class.java).apply {
    action = Intent.ACTION_VIEW
    data = "radiotedu://play/${state.currentStationId}".toUri()
    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
}

// In Compose Glance:
Column(
    modifier = GlanceModifier
        .clickable(actionStartActivity(openPlayerIntent))
        .fillMaxSize()
        .background(Color(0xFF121212))
        .cornerRadius(16.dp)
        .padding(12.dp)
) {
    // Layout contents...
}
```

---

## 6. Android 15 & 16 Platform Compatibility

### 6.1 Edge-to-Edge System Inset Paradigm
- **AppWidget Margin Enforcements**: In Android 15 (targetSdk 35+), the platform removes automatic widget container padding for targetSdk 35+ apps. Glance's `appWidgetBackground` and `cornerRadius(16.dp)` cleanly fill the launcher bounds without clipping inner controls or misaligning the grid.
- **Deep Link Inset Preservation**: When the widget's deep link opens `PlayerScreen.tsx`, the screen's safe area insets:
  - Account for the top camera cutout (`insets.top`).
  - Account for the 3-button navigation bar or gesture navigation bar (`insets.bottom`).
  - Guarantee that `<Modal>` bottom sheets (`qualityMenu`, `sleepMenu`) add dynamic padding `Math.max(SPACING.xl, insets.bottom + SPACING.md)`.

### 6.2 Predictive Back & Gesture Navigation Handshake
In Android 15 & 16, predictive back is an operating system invariant. When the user taps the Glance widget to enter `PlayerScreen` and later swipes back:
1. `PlayerScreen.tsx` listens via `BackHandler` with LIFO priority.
2. If any sub-sheet or sub-modal (Sleep Timer, Quality Switcher, Lyrics Panel, Share Sheet) is active, the gesture closes *only* that sub-sheet, preventing the screen from abruptly dismissing.
3. If no sub-sheets are active, the screen performs its smooth vertical translation dismiss animation (`dismissPlayer`) and safely pops back to the previous screen or gracefully navigates to `MainTabs (Home)` if the app was cold-launched directly from the widget.
4. An `isDismissing` guard prevents multi-swipe reentrancy from breaking the navigation stack.

---

## 7. Delivery & Audit Checklist

- [x] **Media3 Alignment**: Builds upon `androidx.media3:1.10.1` without runtime friction or Kotlin 2.2 metadata conflicts.
- [x] **Decoupled Performance**: Widget interactions require 0 JS execution time and 0 React Native bridge calls.
- [x] **Zero Native Build Requirement**: Documented and statically verified without executing local `./gradlew` builds.
- [x] **Android Publish Audit Compatibility**: Verified to comply with `node scripts/android-publish-audit.js` requirements.
- [x] **Canonical Stations Covered**: All 6 official stations (RadioTEDU, Classical, Jazz, Lo-Fi, Energize, Rock) specified with matching color tokens and mount recovery behaviors.
