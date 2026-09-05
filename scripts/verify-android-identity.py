"""Verify final phone APK identity, signature and clean source provenance."""
import argparse
import json
import re
import subprocess

CERT = 'b3b08db1c4aefbf4251d53951061ada727796479de45d817f9576232ff2d9439'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('apk')
    parser.add_argument('--tools', required=True)
    parser.add_argument('--sha', required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--version-code', required=True, type=int)
    args = parser.parse_args()
    from pathlib import Path
    tools = Path(args.tools)
    import os
    signer = tools / ('apksigner.bat' if os.name == 'nt' else 'apksigner')
    aapt = tools / ('aapt.exe' if os.name == 'nt' else 'aapt')
    certs = subprocess.check_output([str(signer), 'verify', '--print-certs', args.apk], text=True)
    actual = re.findall(r'certificate SHA-256 digest: ([0-9a-f]+)', certs)
    if actual != [CERT]:
        raise ValueError('APK does not have the established production signing certificate')
    badging = subprocess.check_output([str(aapt), 'dump', 'badging', args.apk], text=True)
    expected = "package: name='com.radiotedumobile' versionCode='{}' versionName='{}'".format(args.version_code, args.version)
    if expected not in badging:
        raise ValueError('Unexpected package/version in actual APK')
    manifest = subprocess.check_output([str(aapt), 'dump', 'xmltree', args.apk, 'AndroidManifest.xml'], text=True)
    if not re.search(r'BUILD_GIT_SHA[^\n]*\n[^\n]*' + re.escape(args.sha), manifest):
        raise ValueError('APK source commit differs from requested source')
    if not re.search(r'BUILD_GIT_DIRTY[^\n]*\n[^\n]*0x0\b', manifest):
        raise ValueError('APK was built from a dirty checkout')
    print(json.dumps({'package': 'com.radiotedumobile', 'version': args.version, 'versionCode': args.version_code,
                      'certificateSha256': CERT, 'sourceCommit': args.sha, 'sourceClean': True}))


if __name__ == '__main__':
    main()
