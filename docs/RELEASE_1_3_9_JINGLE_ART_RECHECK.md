# Jingle artwork regression — September 13

Guest navigation on the installed `3d87704` APK completed nine Home/Radio/Podcasts transitions, with fresh UI-tree assertions and a screen recording. Final screenshots were reviewed. The Radio assertion checks catalog presence only; this is not a full stress or playback result. Local evidence: `output/guest-tab-stress-20260913/`.

Review found `TEDU_4` shown with unrelated album art in the mini-player. Live API polling bypassed the stream event parser's jingle normalization and accepted upstream artwork. Stream events also retained explicit artwork even when identified as jingles.

Both paths now discard song artwork for recognized station IDs. Live polling returns the existing `RadioTEDU Jingle` label with empty artwork, allowing the metadata provider's native station fallback. Ordinary song artwork is preserved. No station or stream infrastructure changed.

Regression coverage exercises a live `TEDU_4` payload with unrelated artwork, the equivalent stream event, and ordinary song artwork retention. All 407 mobile tests passed. A new signed APK and direct jingle-transition verification are required before this fix is considered device-verified. The earlier APK remains historical evidence for this defect; no public release is approved by this report.

The final podcast screenshot also contains an unloaded fourth thumbnail. A follow-up several minutes later remained blank. Its official episode API image URL returned HTTP 200, `image/jpeg`, length 488016 bytes from the build computer; that does not prove the emulator fetched or decoded it. The list now places the existing microphone icon beneath the transparent remote image layer, keeping a visible placeholder while loading or after failure. Successful artwork covers that placeholder. APK-level visual verification and the underlying request diagnosis remain open.

Navigation recording duration verified with ffprobe: 65.961489 seconds. The three final screen captures were reviewed; this limited test does not cover authenticated actions, Android Auto projection, or all rendering states.
