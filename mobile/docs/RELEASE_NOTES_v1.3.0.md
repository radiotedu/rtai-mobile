# RadioTEDU Mobile 1.3.0

- Keeps RadioTEDU discoverable as a media app in Android Auto, Automotive OS,
  Google Maps media controls, Wear controllers, Assistant and Gemini through
  the standard Media3 library/session contract. No Maps screen or location
  permission was added.
- Adds Siri/App Intents for stations, podcasts and Voting; Apple Handoff for the
  current listening context; and an in-player AirPlay route picker.
- Adds Google Cast sender support with the Default Media Receiver and the
  current RadioTEDU metadata/artwork.
- Adds a Wear OS Tile and watch-face complication.
- Adds an Android 16 Voting-only promoted Live Update contract. It is driven by
  an explicit trusted round message, expires automatically, and never displays
  Juke queue data.
- Includes isolated source previews for Android AppFunctions alpha11 and Apple
  Voting Live Activities. They remain outside production until the required
  Google EAP / Apple widget-extension signing gates are available.
- Mirrors the repaired WordPress footer-player metadata and cover-art pipeline
  under `website/wordpress-overlay` for versioned deployment.

Android binaries are intentionally not built in this workspace.
