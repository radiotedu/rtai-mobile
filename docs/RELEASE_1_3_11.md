# RadioTEDU 1.3.11

Fixes from the September 19 mobile review:

- Podcast notes persist on this device across restarts, including likes. Storage failures are shown without claiming success. Episode IDs isolate notes; sample academic notes/transcripts are no longer presented as real episode content.
- Android nearby Jam uses native Nearby Connections advertising/discovery over Bluetooth/Wi-Fi. Users opt into device permissions and choose the discovered invitation. Discovery stops when the app backgrounds or the modal closes. The UI no longer claims simulated NFC/acoustic transmission. iOS and devices without Nearby support can use the room code or share link.
- Jam invites carry the six-digit code through the registered deep link into the room entry form. Malformed codes/routes are rejected. A failed server join no longer produces a locally successful room.
- Foreground campus location is explicitly enabled on Home. Coordinates are evaluated locally, discarded in background, and never submitted to the RadioTEDU server. Stale/imprecise fixes do not trigger micro-zone suggestions. Suggested station IDs match the real catalog; overlapping zones choose the nearest centre.
- Fix existing ESLint errors, including effect dependencies. Advance all release version targets to 1.3.11 (phone code 13110).

Validation before native build: 123 Jest suites / 567 tests passed; two additional regression tests passed; TypeScript and ESLint error checks; Android static audit; release version/workflow contracts. Native APK and phone/tablet runtime evidence are produced by GitHub Actions from the release commit. This does not substitute for physical two-device discovery, iOS device testing, or a legal compliance audit.

Implementation references: [Nearby discovery](https://developers.google.com/nearby/connections/android/discover-devices), [Nearby permissions](https://developers.google.com/nearby/connections/android/get-started), [React Native geolocation](https://github.com/michalchudziak/react-native-geolocation).
