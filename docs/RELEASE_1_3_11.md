# RadioTEDU 1.3.11

Podcast transcript, academic/question cards, timecapsules, demonstration data and transcript analytics are removed completely at the user's request. Podcast playback, speed, skip and download remain.

Android nearby Jam now uses native Nearby Connections over Bluetooth/Wi-Fi with explicit permissions, cancellation on background/modal close, and invitation validation. The interface no longer claims simulated NFC/acoustic transmission. iOS and unsupported devices can use invitations or room codes. Cold and warm invitations open a prefilled entry form; joining requires a user action. Server-denied joins do not claim success.

Campus suggestions are opt-in and foreground-only; coordinates stay on the device. Old, unverified micro-zone coordinates were removed. A broad 500m proximity area uses the viewport centre in the official TEDU map (https://www.tedu.edu.tr/haritada-tedu). The listener explicitly chooses Focus, Social, Academic or Sports. GPS does not claim to identify indoor rooms. Stale/inaccurate fixes are ignored, station IDs are correct, and dismissed suggestions stay dismissed. Controls are localized in all six app languages.

All app targets use 1.3.11; Android phone version code is 13110. Source checks: 121 Jest suites / 556 tests, TypeScript, ESLint error checks, 36 Android static checks, and release workflow contracts. Signed APK/AAB outputs come from the GitHub release workflow. Phone/tablet smoke and screenshot evidence is produced from the exact signed candidate. Physical two-device nearby discovery and iOS device verification remain outside automated coverage.

Implementation references: https://developers.google.com/nearby/connections/android/discover-devices and https://github.com/michalchudziak/react-native-geolocation.
