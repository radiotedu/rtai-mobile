# GitHub Actions Signing Secrets

Production Android signing is provisioned only through encrypted GitHub Actions secrets. Configure these four exact repository secret names:

| Secret | Purpose |
|---|---|
| `ANDROID_RELEASE_KEYSTORE_BASE64` | Base64-encoded production keystore bytes |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Signing key alias |
| `ANDROID_KEY_PASSWORD` | Signing key password |

The source workspace contained no production keystore and no production API credential. No value was fabricated, guessed, copied from the development debug keystore, or migrated into Git history.

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
