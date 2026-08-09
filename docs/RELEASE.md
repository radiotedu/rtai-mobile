# Android Release Procedure

## Artifact classes

- **Debug QA APK:** suitable for private installation and functional testing. It may use the standard Android development debug key and is not a production-signed Play Store artifact.
- **Production release APK:** built only by the manual GitHub Actions release workflow after all four encrypted signing secrets are provisioned. Missing signing material must stop the workflow.

Verify any APK before distribution:

```powershell
apksigner verify --verbose --print-certs path\to\RadioTEDU-Mobile.apk
```

Compare the certificate identity with the intended release certificate; a successful cryptographic verification alone does not turn a debug certificate into a production certificate.

## Manual GitHub release

1. Run the CI workflow successfully on `main`.
2. Provision the secrets in the `production` environment as described in [GITHUB_SECRETS.md](GITHUB_SECRETS.md).
3. Open **Actions → Android Release → Run workflow**.
4. Enter the intended tag in the required `tag` input.
5. The workflow installs locked dependencies, builds signed APK/AAB files for phone, TV, and Wear, verifies every signature, uploads checksums, and updates the GitHub Release. Study, voting, and Jukebox controller deploy separately as websites.

Run **iOS Release** with the same tag after Apple approves CarPlay and all iOS
secrets in `GITHUB_SECRETS.md` are configured. It archives the same iOS app
target that contains both the phone UI and CarPlay scene, then attaches the IPA
to the matching GitHub Release. It also validates and uploads that IPA to App
Store Connect, where it becomes available in TestFlight after Apple finishes
processing it.

Both release workflows reject a tag that differs from the version embedded in
the mobile, TV, Wear, or iOS targets. For the current sources, use `v1.1.0`.
They run only from `main` and reject an existing tag that points to a different
commit, so Android and iOS assets cannot silently represent different sources.

The workflow does not print signing values and does not commit the decoded keystore or generated `keystore.properties` file.

## Initial QA artifact

For current private Android device testing, run **Android QA Prerelease** from
`main` with a tag such as `v1.1.0-qa.1`. It publishes three unmistakably
debug-signed APKs: mobile with Android Auto, TV, and Wear. These APKs are not
production or Play Store artifacts and cannot replace v1.0.0 for existing
production-signed installations.

The only approved initial QA artifact is:

- File: `RadioTEDU-Mobile-f2624e15-release.apk`
- SHA-256: `7BE4574E70738899F8FBED3D4A8E836DF38356E6523B9C998961F730400F2C3E`
- Signing status: development/debug-signed QA artifact, not production-signed

For the private GitHub QA release it may be renamed to `RadioTEDU-Mobile-initial-qa-debug-signed.apk` without modifying its bytes.

`RadioTEDU-Mobile-bf6ea0b0-release.apk` predates the dual-logo splash. It must not be uploaded or published as the final release.
