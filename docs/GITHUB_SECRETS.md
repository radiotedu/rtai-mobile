# GitHub Actions Signing Secrets

Production signing is provisioned only through encrypted GitHub Actions secrets. Configure these exact secret names in the `production` environment (preferred) or as repository secrets:

| Secret | Purpose |
|---|---|
| `ANDROID_RELEASE_KEYSTORE_BASE64` | Base64-encoded production keystore bytes |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Signing key alias |
| `ANDROID_KEY_PASSWORD` | Signing key password |

The source workspace contained no production keystore and no production API credential. No value was fabricated, guessed, copied from the development debug keystore, or migrated into Git history.

Starting with v1.1.0, production packages use the permanent certificate `CN=RadioTEDU, OU=Mobile, O=RadioTEDU, L=Istanbul, ST=Istanbul, C=TR` with SHA-256 fingerprint `B3:B0:8D:B1:C4:AE:FB:F4:25:1D:53:95:10:61:AD:A7:27:79:64:79:DE:45:D8:17:F9:57:62:32:FF:2D:94:39`. The release workflow rejects any other keystore. Back up this private key permanently; every future update depends on it.

The v1.0.0 private key is unavailable. Therefore v1.1.0 is a fresh-install signing lineage and cannot update an installed v1.0.0 APK in place. Users must uninstall v1.0.0 before installing v1.1.0. This limitation does not affect future updates signed with the v1.1.0 key.

## Encode the production keystore

Run locally, substituting the path to the real production keystore:

```powershell
$path = 'C:\secure\radiotedu-release.jks'
$keystoreBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
```

Keep `$keystoreBase64` in memory only and do not write it to a tracked file.

## Set secrets with GitHub CLI

The commands below read values from standard input so the values do not appear as command-line arguments. Replace only the local variables or secure prompts; never commit their values.

```powershell
$keystoreBase64 | gh secret set ANDROID_RELEASE_KEYSTORE_BASE64 --repo radiotedu/rtai-mobile
$keystorePassword | gh secret set ANDROID_KEYSTORE_PASSWORD --repo radiotedu/rtai-mobile
$keyAlias | gh secret set ANDROID_KEY_ALIAS --repo radiotedu/rtai-mobile
$keyPassword | gh secret set ANDROID_KEY_PASSWORD --repo radiotedu/rtai-mobile
```

After provisioning, confirm only the secret names and update timestamps with `gh secret list --repo radiotedu/rtai-mobile`. GitHub does not reveal stored secret values.

The workflow must fail when any required secret is absent. It must never silently fall back to the checked-in debug keystore for a production release.

## iOS and CarPlay signing

The iOS release workflow also requires these repository secrets:

| Secret | Purpose |
|---|---|
| `APPLE_TEAM_ID` | Apple Developer team identifier |
| `IOS_BUNDLE_ID` | Registered App ID bundle identifier |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | Exported App Store distribution `.p12` |
| `IOS_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | App Store profile containing the CarPlay audio entitlement |
| `IOS_KEYCHAIN_PASSWORD` | Ephemeral CI keychain password |
| `APP_STORE_CONNECT_API_KEY_ID` | Team App Store Connect API key ID |
| `APP_STORE_CONNECT_API_ISSUER_ID` | Team API issuer UUID |
| `APP_STORE_CONNECT_API_PRIVATE_KEY_BASE64` | Base64-encoded team `AuthKey_*.p8` used for TestFlight upload |

Apple must approve the Audio App CarPlay capability before the profile is
created. The workflow verifies the certificate identity, team, bundle ID, and
CarPlay entitlement before archiving. Stored GitHub secret values cannot be
recovered from a release binary.

Use a team API key with the Developer role or higher; individual API keys are
not supported by this `altool` upload path. The workflow validates the IPA,
uploads it to App Store Connect for TestFlight processing, and removes the
private key from the ephemeral runner.
