# ADR: innovative media surfaces without a Maps feature

## Decision

RadioTEDU remains one media product with one playback identity. Android Auto,
Google Maps, Gemini, Wear and system controls discover the existing Media3
`MediaLibraryService`; the app does not embed a Maps SDK or request location.
Apple uses App Intents for explicit commands and `NSUserActivity` for Handoff.
Cast and AirPlay are output routes, not parallel players.

Experimental agent APIs are isolated. Android AppFunctions is in Google's EAP
and uses a compiler/toolchain that is not yet compatible with the production RN
0.76/Kotlin 1.9 graph. Its source therefore lives in an unlinked preview module.
Apple Live Activities require a separately signed Widget extension, so only the
Voting attributes/controller are staged until that profile exists.

## Guardrails

- No Juke queue is exposed by Live Updates or Live Activities.
- No Gold spend, vote or account mutation is callable by an AI agent.
- No local/remote notification is posted unless a user-opened Voting page sends
  a validated active-round payload; the Android update expires at round end.
- MediaSession remains the production path for driver-safe voice playback.
- Cast pauses local playback only after a receiver session actually starts.
