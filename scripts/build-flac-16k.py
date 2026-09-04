"""Rebuild the existing ExoPlayer FLAC JNI with pinned upstream sources and NDK r28.

Retains the shipped Java API/classes. Writes only to ignored Android build output.
Run on the build computer/CI, before Gradle. No binary-header patching.
"""
import argparse
import io
import os
from pathlib import Path
import subprocess
import tarfile
import urllib.request
import zipfile

EXOPLAYER = 'f42566558294c91f0c1425299b3f4e322767d90c'
FLAC = 'ac39d3719f16dfb6e08d2fbde8ccaf34a266c81d'
NDK = '28.0.13004108'
ROOT = Path(__file__).resolve().parents[1]


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sdk', default=os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT'))
    args = parser.parse_args()
    if not args.sdk:
        parser.error('Android SDK path is required')
    ndk = Path(args.sdk) / 'ndk' / NDK
    if not (ndk / 'source.properties').is_file():
        raise RuntimeError(f'Install pinned NDK {NDK} first')
    work = ROOT / 'mobile/android/build/flac-16k'
    jni = work / 'jni'
    jni.mkdir(parents=True, exist_ok=True)
    files = ['Android.mk', 'Application.mk', 'flac_sources.mk', 'flac_jni.cc',
             'flac_parser.cc', 'include/flac_parser.h', 'include/data_source.h']
    for name in files:
        target = jni / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(fetch(f'https://raw.githubusercontent.com/google/ExoPlayer/{EXOPLAYER}/extensions/flac/src/main/jni/{name}'))
    archive = fetch(f'https://codeload.github.com/xiph/flac/tar.gz/{FLAC}')
    # Extract only regular source files beneath the expected immutable prefix.
    prefix = f'flac-{FLAC}/'
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        for member in tar.getmembers():
            if not member.isfile() or not member.name.startswith(prefix):
                continue
            relative = Path(member.name[len(prefix):])
            if relative.is_absolute() or '..' in relative.parts:
                raise RuntimeError('Unsafe source archive path')
            target = jni / 'flac' / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(tar.extractfile(member).read())
    subprocess.run([str(ndk / ('ndk-build.cmd' if os.name == 'nt' else 'ndk-build')),
                    f'NDK_PROJECT_PATH={work}', f'APP_BUILD_SCRIPT={jni / "Android.mk"}',
                    f'NDK_APPLICATION_MK={jni / "Application.mk"}', 'APP_PLATFORM=android-24',
                    'APP_ABI=armeabi-v7a arm64-v8a x86 x86_64',
                    'APP_SUPPORT_FLEXIBLE_PAGE_SIZES=true', '-j4'], check=True)
    original = ROOT / 'mobile/android/vendor/exoplayer-flac-2.19.0-radiotedu.aar'
    output = ROOT / 'mobile/android/build/vendor/exoplayer-flac-2.19.0-radiotedu.aar'
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(original) as source, zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as dest:
        for item in source.infolist():
            if not item.filename.startswith('jni/'):
                dest.writestr(item, source.read(item))
        for abi in ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64']:
            library = work / 'libs' / abi / 'libflacJNI.so'
            dest.write(library, f'jni/{abi}/libflacJNI.so')
        dest.write(jni / 'flac/COPYING.Xiph', 'META-INF/FLAC-COPYING.Xiph')
    print(f'Built {output}')


if __name__ == '__main__':
    main()
