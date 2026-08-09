# GitHub Actions Signing Secrets

Production Android signing is provisioned only through encrypted GitHub Actions secrets. Configure these four exact repository secret names:

| Secret | Purpose |
|---|---|
| `ANDROID_RELEASE_KEYSTORE_BASE64` | Base64-encoded production keystore bytes |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Signing key alias |
| `ANDROID_KEY_PASSWORD` | Signing key password |

The source workspace contained no production keystore and no production API credential. No value was fabricated, guessed, copied from the development debug keystore, or migrated into Git history.

The v1.0.0 AAB is signed by `CN=RadioTEDU Android, O=RadioTEDU, L=Ankara, C=TR` with SHA-256 certificate fingerprint `AE:0B:BE:47:4C:CF:16:24:F0:26:49:41:7F:7F:A0:E8:CF:B6:CA:2C:5B:A0:F3:6E:0D:22:FB:41:B2:BD:BC:B4`. The release workflow rejects any keystore that does not match this public fingerprint, preventing an update-incompatible release.

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
