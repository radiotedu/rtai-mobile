# RadioTEDU 1.3.9 verification addendum — September 11, 2026

This supplements the original verification report and archived evidence; it does not certify release readiness. Binary source remains `700fdf4cc4e437621d15ee8e9b924c6bf2a7ba3f`.

## Stream service recovery

At 12:12 UTC, all 12 stream variants passed real audio decoding from the build computer: RadioTEDU, Classical, Jazz, Lo-Fi, Energize, Rock, English, French, Voting, Classical FLAC, Jazz FLAC and Lo-Fi low. Each produced 12 seconds of non-silent PCM and a successful decoder exit. No stream infrastructure or station configuration was changed. This supersedes the earlier upstream failure observations at the transport/audio-decoder level; final-APK live playback, album art and Wi-Fi lyrics still need a new device run.

## Emulator and recording recovery

The existing phone emulator was suspended by Windows. Resuming that same process restored ADB access and recovered recording 63. Its H.264 video is 540×1200 and 6.025 seconds long. It supplements the previously verified final recap PNG; it is not a full stress-test recording.

The phone emulator subsequently exited; its host processes disappeared. The cause has not been established. Its Android Auto package was version `1.2.542030-stub`, which does not establish full projection support.

The existing Android Auto test emulator then refused to launch with the explicit SDK error that disk space was insufficient. C: had approximately 1.5 GB free. No disk guard was bypassed, emulator data wiped, application uninstalled, or existing file deleted.

## Remaining gates

Free at least 8 GB outside project/backups, or supply a USB-debugging Android phone with Android Auto, to resume device testing. Authenticated Gold/game/device checks still require an isolated HTTP backend. Full Android Auto projection, final lyric/image receipt in WhatsApp/Instagram, and remaining device stress checks are unverified. The original report lists additional tablet, iOS runtime and store-review limits. Keep the release draft; no Google Play submission.
