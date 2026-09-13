# Remaining device-test prerequisites

September 13, 2026. Current candidate APK source: `3d8770486040f08c9257bb2b33250e4db5060403`, APK SHA-256 `f0eeece213e6cfbf1fb4f7fafacb5df3e293aa2c34c11979549e271601d1d5e3`. Production signature, package/version and 16 KB ELF/ZIP alignment verified. Public release remains gated by the open runtime checks. See the [current verification report](RELEASE_1_3_9_3D87704_VERIFICATION.md).

## Isolated authenticated APK testing

The signed release resolves its API to `https://radiotedu.com/jukebox/api/v1` in `mobile/src/services/config.ts`. There is no release runtime API override. Supplying an arbitrary staging URL alone therefore cannot connect this exact APK to the isolated database.

For the web-server operator: provide a dedicated synthetic-data backend using the current deployed source and migrations, with production databases, ERP writes, real mail, payments and notifications inaccessible. Supply a documented test-device-only routing method for the existing API origin with normal valid TLS verification. Do not change public DNS, production routing or real users' balances. Keep certificates' private keys and service credentials on the server, outside Git and chat. If this routing cannot be provided, report that limitation; an APK rebuilt for staging is separate evidence and must not be represented as the final release binary.

Return only the tested backend commit, isolated environment identifier, routing/access instructions, supported synthetic registration/verification flow, and proof that the environment cannot write production data. Deliver any disposable credentials through an appropriate private channel, not the repository. No authorized isolated HTTP endpoint or usable disposable session has yet been supplied to this build task.

Required device cases: registration and verification; login; token refresh/rotation; logout and revoked-session behavior; account/Gold totals agreeing across screens; Memory and Flash completion under existing reward rules; earning/spending; exact duplicate retry, changed-payload rejection and lost-response recovery; offline recovery; production-signed upgrade with synthetic account/session data retained. Record the UI and correlate sanitized server ledger evidence. Existing isolated database/handler tests do not replace these APK cases.

## Android Auto projection and sharing recipients

Provide a USB-debugging Android device with full Android Auto installed, or a supported phone emulator with full Android Auto setup. September 13 recheck: only `emulator-5556` is connected and its installed Auto package remains `1.2.542030-stub`. No physical device or full Auto installation is available. Play Store previously reported incompatibility/sign-in requirements; these are historical observations, not a fresh store check. C: now has approximately 541 MiB free, so additional local emulator installation also requires storage. Do not delete backups, wipe emulators or bypass SDK guards.

Native Android Automotive catalog and Lo-Fi playback evidence is available, but it does not prove Android Auto projection. Projection must be tested separately with the actual signed APK, including browsing, transport controls, playback/background transitions and reconnect behavior.

For WhatsApp/Instagram image compatibility, a test device with those recipient apps is needed. Neither package is installed on the connected emulator in the September 13 recheck. Verify the generated PNG reaches their composer with correct artwork, text and proportions; do not send a message or publish a post without explicit authorization for its recipient/destination.

## Evidence boundaries

The build computer can continue source checks and disposable cloud guest/Automotive tests. These prerequisites are for the remaining integration cases, not permission to alter production or weaken release safeguards. No Google Play submission is authorized by this handoff.
