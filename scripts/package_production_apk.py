import os
import zipfile
import subprocess
import shutil
import hashlib

base_dir = r"C:\Users\akgul\OneDrive\Documents\ChatGPT\Mobile"
source_apk = os.path.join(base_dir, r"artifacts\release-v1.3.9-dd91a9c\RadioTEDU-Mobile-v1.3.9.apk")
bundle_path = os.path.join(base_dir, r"mobile\dist\index.android.bundle")
out_dir = os.path.join(base_dir, r"artifacts\release-v1.3.10")
os.makedirs(out_dir, exist_ok=True)

temp_unsigned = os.path.join(base_dir, r"mobile\dist\temp_unsigned_1310.apk")
temp_aligned = os.path.join(base_dir, r"mobile\dist\temp_aligned_1310.apk")
target_apk = os.path.join(out_dir, r"RadioTEDU-Mobile-v1.3.10.apk")
keystore = os.path.join(base_dir, r"artifacts\private-signing\RadioTEDU-release-v1.jks")
key_alias = "radiotedu-release"

cred_file = os.path.join(base_dir, r"artifacts\private-signing\SIGNING-CREDENTIALS.txt")
key_pass = os.environ.get("RADIOTEDU_KEYSTORE_PASSWORD")
if not key_pass and os.path.exists(cred_file):
    with open(cred_file, "r", encoding="utf-8") as cf:
        for line in cf:
            if "Key password:" in line:
                key_pass = line.split("Key password:")[1].strip()
                break

if not key_pass:
    raise RuntimeError("Keystore password could not be resolved from environment or private signing credentials.")

zipalign = r"C:\Users\akgul\AppData\Local\Android\Sdk\build-tools\35.0.0\zipalign.exe"
apksigner = r"C:\Users\akgul\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat"

if os.path.exists(temp_unsigned):
    os.remove(temp_unsigned)
if os.path.exists(temp_aligned):
    os.remove(temp_aligned)

print("Injecting new JS bundle into APK...")
with zipfile.ZipFile(source_apk, 'r') as zin:
    with zipfile.ZipFile(temp_unsigned, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            # Skip old signature files and old bundle
            if item.filename.startswith('META-INF/') and (item.filename.endswith('.SF') or item.filename.endswith('.RSA') or item.filename.endswith('.MF')):
                continue
            if item.filename == 'assets/index.android.bundle':
                continue
            data = zin.read(item.filename)
            zout.writestr(item, data)
        # Write new bundle
        with open(bundle_path, 'rb') as f:
            bundle_data = f.read()
        zout.writestr('assets/index.android.bundle', bundle_data)

print("Aligning APK with zipalign (-f -P 16 4)...")
subprocess.run([zipalign, "-f", "-P", "16", "4", temp_unsigned, temp_aligned], check=True)

print("Signing APK with official production keystore...")
subprocess.run([
    apksigner, "sign",
    "--ks", keystore,
    "--ks-key-alias", key_alias,
    "--ks-pass", f"pass:{key_pass}",
    "--key-pass", f"pass:{key_pass}",
    "--out", target_apk,
    temp_aligned
], check=True)

print(f"Verifying signed production APK {target_apk}...")
subprocess.run([apksigner, "verify", "--verbose", target_apk], check=True)
subprocess.run([apksigner, "verify", "--print-certs", target_apk], check=True)

# Also check 16KB alignment
subprocess.run([zipalign, "-c", "-P", "16", "4", target_apk], check=True)

# Calculate SHA-256
h = hashlib.sha256()
with open(target_apk, 'rb') as f:
    while chunk := f.read(8192):
        h.update(chunk)
apk_sha256 = h.hexdigest()
print(f"Production APK SHA-256: {apk_sha256}")

# Write SHA256SUMS.txt
with open(os.path.join(out_dir, "SHA256SUMS.txt"), "w") as f:
    f.write(f"{apk_sha256}  RadioTEDU-Mobile-v1.3.10.apk\n")

print("SUCCESS! Updated Production APK created at:", target_apk)
