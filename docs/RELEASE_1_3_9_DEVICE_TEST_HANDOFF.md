# Remaining device-test prerequisites

September 12, 2026. Current candidate APK source: `a99c37e58abb136e2a4e572e89505aa5f600d200`, APK SHA-256 `3d17a72c8d753dc995e2614c4a3fab053de25c3aaead0bb1a9b70e561ef26c11`. Production signature, package/version and 16 KB ELF/ZIP alignment verified. Public release remains gated by the open runtime checks.

## Isolated authenticated APK testing

The signed release resolves its API to `https://radiotedu.com/jukebox/api/v1` in `mobile/src/services/config.ts`. There is no release runtime API override. Supplying an arbitrary staging URL alone therefore cannot connect this exact APK to the isolated database.

For the web-server operator: provide a dedicated synthetic-data backend using the current deployed source and migrations, with production databases, ERP writes, real mail, payments and notifications inaccessible. Supply a documented test-device-only routing method for the existing API origin with normal valid TLS verification. Do not change public DNS, production routing or real users' balances. Keep certificates' private keys and service credentials on the server, outside Git and chat. If this routing cannot be provided, report that limitation; an APK rebuilt for staging is separate evidence and must not be represented as the final release binary.

Return only the tested backend commit, isolated environment identifier, routing/access instructions, supported synthetic registration/verification flow, and proof that the environment cannot write production data. Deliver any disposable credentials through an appropriate private channel, not the repository. No authorized isolated HTTP endpoint or usable disposable session has yet been supplied to this build task.

Required device cases: registration and verification; login; token refresh/rotation; logout and revoked-session behavior; account/Gold totals agreeing across screens; Memory and Flash completion under existing reward rules; earning/spending; exact duplicate retry, changed-payload rejection and lost-response recovery; offline recovery; production-signed upgrade with synthetic account/session data retained. Record the UI and correlate sanitized server ledger evidence. Existing isolated database/handler tests do not replace these APK cases.

## Android Auto projection and sharing recipients

Provide a USB-debugging Android device with full Android Auto installed, or a supported phone emulator with full Android Auto setup. Disk space was freed and is no longer the current setup blocker. The only connected device is the preserved `RadioTEDU-AndroidAuto-Play` emulator; its installed Auto package is `1.2.542030-stub`. Play Store previously reported Android Auto incompatible and now requires sign-in. No physical device or full Auto installation is available. Do not delete backups, wipe emulators or bypass SDK guards.

Native Android Automotive catalog and Lo-Fi playback evidence is available, but it does not prove Android Auto projection. Projection must be tested separately with the actual signed APK, including browsing, transport controls, playback/background transitions and reconnect behavior.

For WhatsApp/Instagram image compatibility, a test device with those recipient apps is needed. Verify the generated PNG reaches their composer with correct artwork, text and proportions; do not send a message or publish a post without explicit authorization for its recipient/destination.

## Evidence boundaries

The build computer can continue source checks and disposable cloud guest/Automotive tests. These prerequisites are for the remaining integration cases, not permission to alter production or weaken release safeguards. No Google Play submission is authorized by this handoff.
