# RadioTEDU Android Auto / Automotive implementation

RadioTEDU ships one phone/tablet APK. The same package exposes a native Media3
library and playback service to Android Auto, Android Automotive OS, Assistant,
Gemini, system media controls, and Wear controllers.

## Published car surface

The root has exactly two destinations, in this order:

1. **Live Radio** — playable RadioTEDU stations.
2. **Podcasts** — playable podcast episodes.

Rankings, “What TEDU Plays”, Jukebox, voting, games, Study, accounts, and other
phone-only screens are never published to the car catalog. The native service
enforces this allowlist again when reading cached JSON, so an old catalog from a
previous app version cannot restore removed categories through a headless car
launch, search, suggestions, media-id lookup, or playback queues.

On a fresh install, before React Native has produced a catalog, both root
destinations remain visible. Live Radio contains a built-in RadioTEDU fallback;
Podcasts is safely empty until podcast data has been cached.

## Architecture

`RadioTeduCarService` is the only car browser. It is a Media3
`MediaLibraryService` with one `MediaLibrarySession` and a native ExoPlayer.
The manifest publishes both the Media3 action and the legacy platform media
browse action for compatible hosts. React Native Track Player remains the phone
player and is not a second car browser.

The JS bridge writes availability-filtered stations and podcast episodes to
SharedPreferences. Each playable item contains its resolved audio URL, title,
subtitle, artwork, audio format, quality, and podcast series identifier. Native
playback therefore works when Android starts the service without the app UI or
JS runtime.

ExoPlayer requests ICY metadata and updates the Media3 title, artist, and station
fields. Radio metadata keeps the station name while exposing song/artist data
when the mount supplies it. RadioTEDU Lo-Fi intentionally keeps station-only
metadata for low and normal streams.

The phone-selected stream quality is serialized into the car catalog. Classic
and Jazz can therefore resolve to FLAC. The service rejects FLAC on a metered
network and sends the localized high-data-use warning; it also removes adjacent
FLAC items from a metered Next/Previous queue. Quality is not a custom driving
control.

Podcast queues are filtered by `seriesId`, so Next/Previous cannot jump to a
different show. Absolute playback position and duration are persisted, resumed
below the completion threshold, and cleared when an episode is completed.

The player owns audio focus. Connect/read timeouts, a buffering watchdog, and
localized session errors prevent an unavailable stream from spinning forever.

## Browse and artwork contract

- Root browsable style: grid.
- Playable leaves: list.
- Lists and search results honor Media3 pagination.
- Suggested content contains stations plus the first episode per podcast series.
- Root and station artwork use packaged square resources.
- Full-resolution artwork URI remains available while a small bounded bitmap is
  embedded for hosts that cannot dereference another package's resource URI.
- Podcast artwork uses its feed image when available.

## Voice

Native Unicode-aware search supports RadioTEDU station aliases in English,
Turkish, Arabic, Russian, German, and French. Latest-podcast intent matching is
word based, so branded phrases such as “Play the latest RadioTEDU podcast” do
not require “latest” and “podcast” to be adjacent. Empty normalized queries do
not silently start the first station.

## Verification

From `mobile/android`:

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:compileDebugKotlin
.\gradlew.bat :app:assembleDebug
```

Source and JVM tests protect the catalog and voice policies. A final signed
build still requires DHU/AAOS runtime verification for host-rendered artwork,
metadata, browse pagination, voice, playback, audio focus, and metered-network
errors.
