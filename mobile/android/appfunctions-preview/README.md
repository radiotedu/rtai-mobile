# Android AppFunctions preview

This source-only module isolates Android's experimental AppFunctions API from
the production React Native/Kotlin 1.9 build. Gemini/Assistant playback in the
shipping app continues through the standard Media3 `MediaLibraryService`, which
is also the contract used by Android Auto, Automotive OS and Google Maps media
controls.

The preview targets `androidx.appfunctions:appfunctions:1.0.0-alpha11` and its
KSP compiler. Google currently limits end-to-end Gemini invocation to the
AppFunctions EAP. After RadioTEDU is admitted, include this module in
`settings.gradle`, supply the matching KSP plugin, and run it only in a closed
track before merging it into the production app module.

No Gold spend, vote or account mutation is exposed here. The functions only
open a listener-selected station, podcasts or Voting; Media3 remains the
authoritative playback path.
