# Publication ledger

2026-09-05: Verified exact 5f4de3f APK/terminal artifacts; documented failures and limited final-binary coverage. Added reviewed phone/terminal/desktop previews and prepared a GitHub prerelease at the binary source commit. Report: docs/RELEASE_1_3_7_VERIFICATION.md.

2026-09-08 approved v1.3.9 work: measured tab-bar layout and explicit navigation readiness; bounded foreground setup retry; native PNG share/save bridges for lyrics, recap and now playing; online-only game entry, Flash Memory mode using existing Memory scoring/rewards, effects/haptics, local result history; offline result retry preserves proof and frozen payload; terminal wide details and refined spacing. Existing 1.3.8 CI failed on Media3 Builder.setSmallIcon; moved call to built provider. Full source backup release139-20260908-065823. TypeScript/lint, 18 targeted regressions, 25 terminal tests and Android audit 36/36 pass. Final Actions build and device stress tests remain pending; do not claim release-ready. No backend or production Gold changes.

2026-09-11: redesigned sharing posters in native views; no new dependencies or API changes. 403 tests and TypeScript pass; final signed build/export visual QA pending.

2026-09-11: recordings 55–57 verify redesigned PNG exports and expose podcast-share metadata bug. Fixed snapshot to use displayed metadata; preserved artwork and existing radio presentation. Backup share-podcast-20260911-090128.

2026-09-11: fixed timezone-sensitive recap week rollover, with failing-before/passing-after isolated regression. Backup share-timezone-20260911-090509. New signed candidate required; native poster layout already verified on 917f835.
