# ADR: Media3 voice and playback parity for release 1.2.9

Date: 2026-08-31

## Decision

Android Auto and Android Automotive OS keep `RadioTeduCarService` as the single
owner of browse, search, Assistant, and Gemini play-from-search requests. The
service stays on Media3 1.10.1 and uses decoder fallback plus extension-renderer
preference. The RN Track Player service continues phone playback but no longer
claims play-from-search, preventing voice queries from reaching its legacy,
non-browsable session.

Android TV and Wear OS now use a shared Media3 1.10.1 `MediaLibraryService` with
browse, search, playback resumption, ICY-enabled HTTP, artwork, voice routing,
and the same decoder selection policy. No AndroidX legacy media implementation
is introduced.

## Cross-platform consequences

- Android/Huawei phone builds retain the packaged RNTP and FLAC codec AARs.
- Android Auto, Automotive OS, TV, and Wear use current Media3 and Android codec
  capabilities; renderer extensions are preferred whenever packaged/present.
- iPhone and iPad forward ERP custom-scheme and universal-link callbacks from
  both AppDelegate and scene lifecycle entry points into React Native.
- CarPlay keeps its native Apple media templates and player path.
- Terminal playback continues through mpv or ffplay and now advertises the
  actual HE-AAC v2/AAC-LC/MP3/Ogg-Opus/FLAC compatibility contract.
- Shared React Native games grant Gold only through an online, server-verified
  game session. An explicitly offline round returns zero Gold and does not queue
  a replayable reward submission.

## Validation boundary

The release has executable source-contract, TypeScript, Jest, terminal, and
release-version checks. Android/Gradle builds are intentionally delegated to the
signed GitHub release workflow, matching the repository release policy.

Reference contracts:

- https://developer.android.com/media/implement/assistant
- https://developer.android.com/media/media3/exoplayer/supported-formats
