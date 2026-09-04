"""Prepare pinned Media3 FLAC sources; native compilation happens in Actions."""
import io
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MEDIA = '5fb306449733dd71595700c1227ad6087578c559'  # Media3 1.10.1
FLAC = '1507800de4b70e21be71f38caa0d9079d0bc6e45'  # libFLAC 1.5.0


def extract(repo, revision, prefix, destination):
    url = f'https://codeload.github.com/{repo}/tar.gz/{revision}'
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read()
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for member in archive.getmembers():
            if not member.isfile() or not member.name.startswith(prefix):
                continue
            relative = Path(member.name[len(prefix):])
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError('Unsafe archive path')
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())


def main():
    work = ROOT / 'mobile/android/build/media3-flac'
    extract('androidx/media', MEDIA,
            f'media-{MEDIA}/libraries/decoder_flac/src/main/', work)
    extract('xiph/flac', FLAC, f'flac-{FLAC}/', work / 'jni/libflac')
    # Android 32-bit exports fseeko64 via stdio.h's large-file alias. A bare
    # link-symbol probe misses it and incorrectly enables fseek fallback macros.
    flac_cmake = work / 'jni/libflac/CMakeLists.txt'
    config = flac_cmake.read_text()
    probe = 'check_function_exists(fseeko HAVE_FSEEKO)'
    assert config.count(probe) == 1
    config = config.replace(probe, '''check_c_source_compiles("\n#define _FILE_OFFSET_BITS 64\n#include <stdio.h>\nint main(void) { return fseeko(stdin, 0, SEEK_SET); }\n" HAVE_FSEEKO)''')
    flac_cmake.write_text(config)
    # RN Track Player uses ExoPlayer 2's flacJNI. Give Media3 its own soname
    # so loading one decoder cannot hide the other decoder's JNI entry points.
    java = work / 'java/androidx/media3/decoder/flac/FlacLibrary.java'
    source = java.read_text()
    assert source.count('new LibraryLoader("flacJNI")') == 1
    java.write_text(source.replace('new LibraryLoader("flacJNI")',
                                   'new LibraryLoader("media3flacJNI")'))
    cmake = work / 'jni/CMakeLists.txt'
    cmake.write_text(cmake.read_text().replace('flacJNI', 'media3flacJNI'))
    licenses = work / 'assets/media3-flac-licenses'
    licenses.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(
            f'https://raw.githubusercontent.com/androidx/media/{MEDIA}/LICENSE',
            timeout=60) as response:
        (licenses / 'Apache-2.0.txt').write_bytes(response.read())
    (licenses / 'FLAC-COPYING.Xiph').write_bytes(
        (work / 'jni/libflac/COPYING.Xiph').read_bytes())
    print(f'Prepared Media3 {MEDIA}, libFLAC {FLAC}: {work}')


if __name__ == '__main__':
    main()
