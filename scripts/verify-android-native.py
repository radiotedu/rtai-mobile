"""Check actual APK/AAB native ELF segments; APKs additionally require zipalign."""
import argparse
import json
from pathlib import Path
import struct
import subprocess
import zipfile


def verify(path, zipalign=None):
    checked = []
    failures = []
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if not name.endswith('.so') or not any(abi in name for abi in ('/arm64-v8a/', '/x86_64/')):
                continue
            data = archive.read(name)
            if data[:6] != b'\x7fELF\x02\x01':
                raise ValueError(f'Expected little-endian ELF64: {name}')
            offset = struct.unpack_from('<Q', data, 32)[0]
            size, count = struct.unpack_from('<HH', data, 54)
            segments = []
            for index in range(count):
                entry = offset + index * size
                if struct.unpack_from('<I', data, entry)[0] == 1:
                    file_offset, address = struct.unpack_from('<QQ', data, entry + 8)
                    alignment = struct.unpack_from('<Q', data, entry + 48)[0]
                    segments.append(alignment)
                    if alignment < 16384 or (address - file_offset) % 16384:
                        failures.append(name)
            if not segments:
                raise ValueError(f'No loadable segments: {name}')
            checked.append({'library': name, 'minAlignment': min(segments)})
    if not checked:
        raise ValueError('No 64-bit native libraries found')
    if failures:
        raise ValueError('16 KB incompatible: ' + ', '.join(sorted(set(failures))))
    if Path(path).suffix == '.apk':
        if not zipalign:
            raise ValueError('APK verification requires --zipalign')
        subprocess.run([zipalign, '-c', '-P', '16', '4', str(path)], check=True)
    print(json.dumps({'artifact': str(path), 'elf16k': True, 'libraries': checked,
                      'apkPackaging16k': bool(zipalign) if str(path).endswith('.apk') else None}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('artifact')
    parser.add_argument('--zipalign')
    args = parser.parse_args()
    verify(args.artifact, args.zipalign)
