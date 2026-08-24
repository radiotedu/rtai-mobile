## RadioTEDU Mobile v1.2.5

- Android Auto now shows proper Live Radio and Podcasts icons, full `RadioTEDU …` station names, complete podcast catalog mapping, cover art, and richer media metadata.
- Car playback is restricted to Normal and Low mounts. FLAC remains an explicit phone-only choice for Classical and Jazz after the mobile-data warning.
- Phone UI uses Hi-Fi wording for lossless availability and keeps quality changes on the selected station without rebounding through another stream.
- Radio buffering targets 5 seconds on phone and 4–5 seconds in the car to reduce microdrops.
- Voting uses `/spark` only. Voting, English, and French stations appear only while their mount is available.
- Podcast episodes inherit series cover art when episode-specific artwork is absent.
- Snake, Memory, Blocks, Rhythm, and Word Guess received the revised game experience. A mini-player overlap that blocked the Games Play button is fixed.
- Notification permission is requested after the Terms decision for more reliable background playback.
- Includes the new restrained 1080×1920 Play Store artwork based on real app captures.

### Verification

- 73 test suites and 271 tests passed.
- TypeScript check passed.
- Android publishing audit passed 36/36.
- Android release APK and signed Play Store AAB built successfully.
