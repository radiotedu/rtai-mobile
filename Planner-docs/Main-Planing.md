# RadioTEDU 1.3.6 candidate

Baseline: 08a6b66, preserved by fast-forward and timestamped external source archives.

Upgrade React Native/Hermes to the first compatible 0.77 patch line, retain React 18 and the existing app architecture, and rebuild the same FLAC decoder with NDK r28. Preserve all stations, homepage, games and production identity. Make Actions generate a candidate without publishing until runtime checks pass.

Files: mobile package manifests; Android native build config/vendor build script; iOS AppDelegate/deployment target; binary verification script; CI/release workflows and focused regressions.

Success: source checks pass; established certificate and 1.3.6/13060 verified on final APK; every 64-bit ELF PT_LOAD aligned to 16 KB; ZIP packaging aligned; emulator upgrade and feature checks recorded. Separate external stream and authenticated test blockers from client defects. Never claim untested device behavior.

Validation: Jest, tsc, ESLint, release-version and Android audit; isolated backend tests; Actions Android release/iOS simulator build; binary inspection and emulator runtime evidence. Risks: Kotlin/native module migration, FLAC source compatibility, stream availability, unavailable isolated account credentials. No production data mutations or Play publishing.
