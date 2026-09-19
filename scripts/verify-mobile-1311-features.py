"""Read-only invitation routing and removed-feature checks on a disposable emulator."""
from pathlib import Path
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
import zipfile
import uiautomator2 as u2

apk, directory = sys.argv[1:3]
output = Path(directory)
package = 'com.radiotedumobile'
device = u2.connect()
device.jsonrpc.setConfigurator({'waitForIdleTimeout': 0, 'waitForSelectorTimeout': 0})

def adb(*args, binary=False):
    return subprocess.check_output(['adb', *args], text=not binary, timeout=40)

def snapshot(name):
    (output / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))
    xml = device.dump_hierarchy(compressed=False, max_depth=80)
    (output / (name + '.xml')).write_text(xml, encoding='utf-8')
    return ET.fromstring(xml)

with zipfile.ZipFile(apk) as archive:
    bundle = archive.read('assets/index.android.bundle')
    for removed in (b'podcast-open-transcript-pill', b'podcast-player-transcript-toggle', b'podcast-transcript-modal', b'transcript_seek'):
        assert removed not in bundle, 'Removed podcast feature remains in shipped bundle'

adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0')
adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
checks = ['Transcript/card/note entry points and transcript telemetry absent from shipped JS bundle']
for label, code in [('cold', '123456'), ('warm', '654321')]:
    if label == 'cold':
        adb('shell', 'am', 'force-stop', package)
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'radiotedu://jam?code=' + code, package)
    time.sleep(10)
    root = snapshot('feature-jam-' + label)
    inputs = [n for n in root.iter('node') if n.get('resource-id', '').endswith('campus-jam-code-input')]
    assert inputs and inputs[0].get('text') == code, label + ' invitation did not populate room input'
    assert not any(n.get('resource-id', '').endswith('campus-jam-room-code') for n in root.iter('node')), 'Invite must not auto-join'
    checks.append(label + ' invitation opens prefilled entry form without joining a live room')
    close = next(n for n in root.iter('node') if n.get('resource-id', '').endswith('campus-jam-close-btn'))
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', close.get('bounds')))
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
    time.sleep(1)

(output / 'feature-checks.json').write_text(json.dumps({'checks': checks}, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks}))
