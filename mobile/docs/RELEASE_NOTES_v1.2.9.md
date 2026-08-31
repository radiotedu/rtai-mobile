# RadioTEDU Mobile 1.2.9

- Android Auto/Automotive: current Media3 browse/search, Gemini and Assistant
  play-from-search ownership, packaged station/category/Hi-Fi icons, ICY
  metadata, artwork, decoder fallback, and extension preference.
- Android TV and Wear OS: Media3 1.10.1 library/search/voice parity with artwork
  and resilient HTTPS stream playback.
- Android/Huawei: packaged phone playback and FLAC codec libraries retained;
  no Google Play dependency was added to core playback, account, or Gold APIs.
- iPhone/iPad: ERP login now returns to the app across classic, scene-based,
  foreground, and cold-start deep-link paths. CarPlay remains enabled, and the
  Firebase Swift dependency graph is modularized for reproducible CocoaPods CI.
- Games: directional controls are square; Gold is issued only by an online,
  server-verified round and the shared balance event updates the account UI.
- Terminal: mpv/ffplay playback contract covers HE-AAC v2, AAC-LC, MP3,
  Ogg/Opus, and FLAC.

Local Android and iOS binaries are not built by the source preparation process;
signed artifacts are produced by the repository release workflows. Android AAB
integrity is verified after the pinned release certificate check without
misclassifying the expected self-signed Play upload key as a CA-chain failure.
