# RadioTEDU car media product contract

Status: implemented contract for Android Auto and Android Automotive OS.

## Scope

RadioTEDU is a media app in the car. The platform renders the interface from the
Media3 library tree and session metadata; the app does not draw custom car UI.

The complete root is:

```text
RadioTEDU
├── Live Radio
│   └── available RadioTEDU stations
└── Podcasts
    └── available podcast episodes
```

No Rankings, “What TEDU Plays”, Jukebox, voting, Study, games, account flows, QR
flows, comments, or other interaction-heavy features belong in the car tree.
They remain phone/web features even while parked.

## Safety and interaction

- Playback is reachable by a short browse path or voice.
- Only standard Play, Pause, Stop, Next, Previous, seek, and Media3 host controls
  are exposed where applicable.
- Android Auto/AAOS applies its own moving-vehicle content limits.
- Radio Next/Previous cycles through allowed stations.
- Podcast Next/Previous stays inside the selected series.
- An empty or unsupported voice query does not guess and start unrelated audio.
- Native ExoPlayer owns audio focus and headless car playback.

## Live metadata and quality

Radio items carry station title, square artwork, quality, and audio-format
metadata. ICY song/artist metadata is requested from the stream and normalized
into the Media3 session without losing station identity. Lo-Fi low/normal keeps
the fixed “RadioTEDU Lo-Fi” identity and does not publish song metadata.

The catalog uses the stream quality selected in the phone app. FLAC is available
only where the station catalog provides it. On mobile/metered data, a FLAC start
is rejected with a localized warning explaining its high data use; FLAC is also
removed from metered skip queues. No custom quality picker is added to the
driving surface.

## Podcasts

Podcast data is grouped by feed into stable `seriesId` values. That identifier
defines the native playback queue, ensuring Next/Previous continues the same
show. Media3 metadata includes series identity and completion percentage.
Resumption uses a saved absolute position and never applies podcast seeking to a
live stream.

## Catalog trust boundary

The JS bridge produces the current catalog, but native code treats its persisted
copy as untrusted legacy state. Only `cat_radio`, `cat_podcasts`, and podcast
series directly parented by `cat_podcasts` are accepted. Browse, lookup, search,
suggestions, resumption, and queues all consume that filtered set.

The root always exposes Live Radio and Podcasts. With no valid cache, the Live
Radio branch contains one packaged RadioTEDU fallback and Podcasts is empty.
This keeps cold-start browsing valid without inventing podcast data or exposing
removed categories.

## Visual contract

- Root categories use distinct packaged square symbols.
- Stations retain full-resolution packaged artwork.
- Media3 also receives a small bounded embedded bitmap for cross-package host
  compatibility and Binder safety.
- Podcast episodes use feed artwork when supplied.
- Titles and native errors follow the app language: English, Turkish, Arabic,
  Russian, German, or French.

## Acceptance checks

1. Root contains only Live Radio and Podcasts on fresh and upgraded installs.
2. Old cached Rankings/Jukebox entries cannot browse, search, suggest, or play.
3. Both root symbols render on DHU and AAOS.
4. A live mount shows station plus ICY song/artist metadata when supplied.
5. Metered FLAC attempts show the localized warning and do not start playback.
6. Podcast Next/Previous never leaves the selected series.
7. “Play the latest RadioTEDU podcast” resolves the newest cached episode.
8. Cold headless playback works without opening the React Native UI.
