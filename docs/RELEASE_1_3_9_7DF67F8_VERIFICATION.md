# Signed candidate 7df67f8 — verification status

Not release-ready. Source `7df67f830bb519cbaec603a6587ec2dd70118187`; fixes native podcast metadata being replaced by embedded broadcast labels. Older draft assets and failed runs remain preserved.

## Verified binary

- Package `com.radiotedumobile`, version `1.3.9`, code `13090`, clean embedded source matches the commit above.
- Production certificate SHA-256 `b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439`.
- APK SHA-256 `9276be5ab5ed002c31f6893894dfc28e923a41823bfb9ae7e1d5713f0effb75f`.
- AAB SHA-256 `58c274afa77a7d9b1e7ada2c82f4b0b6ea3e0015a9bdd0cddc5ee996d4516c0b`.
- Actual APK signature, identity, all 26 64-bit ELF libraries and APK ZIP alignment passed. AAB ELF checks also passed.
- [Signed build](https://github.com/radiotedu/rtai-mobile/actions/runs/34751673739) passed. [CI Android verification](https://github.com/radiotedu/rtai-mobile/actions/runs/34751841133) passed on the same app code with test-driver changes; iOS job remains pending completion review. No local native build was performed.
- Upgrade from 63494e4 succeeded without uninstall. A real broadcast jingle was observed while playback was paused: mini-player title `RadioTEDU Jingle` and RadioTEDU station artwork both visually confirmed. This checks metadata presentation, not jingle audio. Evidence: `output/device-7df67f8/`.

## Device results and unresolved failures

[Run 34752248070](https://github.com/radiotedu/rtai-mobile/actions/runs/34752248070): tablet driver passed guest startup/restarts, large-font home, radio/background controls, offline recovery and both PNG exports. Its 2560×1800 landscape capture was visually reviewed; home hero/button, station shelf and podcast rows fit. Phone failed initial radio playback with the app session in ERROR. Root cause remains unresolved.

[Automotive run 34752246845](https://github.com/radiotedu/rtai-mobile/actions/runs/34752246845) failed catalog traversal before podcast testing. Eight station labels were observed; the list repeatedly returned toward the top before reaching Voting. This does not prove Voting is absent and does not validate the podcast-title fix. Catalog refresh/paging behavior needs further investigation.

Same-APK diagnostic reruns: [Automotive 34752633441](https://github.com/radiotedu/rtai-mobile/actions/runs/34752633441), [phone/tablet 34752634500](https://github.com/radiotedu/rtai-mobile/actions/runs/34752634500). Assertions remain unchanged; bounded system logs were added to distinguish app/service errors from host/test failures. Results are pending review.

## Remaining release gates

Full Android Auto projection still requires a full Auto installation/device. Isolated registration, authentication/session, Gold consistency, earning/spending/duplicates and authenticated upgrade tests need the [backend test handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). Recipient-app sharing, remaining language/stress/device coverage and final store declarations remain open. The draft is not approval to publish or submit to Google Play.
