"""Guest-only runtime evidence from a disposable CI emulator; never an Auto/Gold gate."""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

PACKAGE = 'com.radiotedumobile'
output = Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
checks = []
sequence = 0


def adb(*args, binary=False, check=True, timeout=35):
    result = subprocess.run(['adb', *args], capture_output=True,
                            text=not binary, timeout=timeout, check=check)
    return result.stdout


def snapshot(label):
    global sequence
    sequence += 1
    stem = f'{sequence:02d}-{label}'
    (output / f'{stem}.png').write_bytes(adb('exec-out', 'screencap', '-p', binary=True))
    for attempt in range(4):
        remote = f'/sdcard/qa-{sequence}-{attempt}.xml'
        adb('shell', 'uiautomator', 'dump', remote, check=False)
        raw = adb('shell', 'cat', remote, check=False)
        if '<hierarchy' in raw:
            root = ET.fromstring(raw[raw.index('<?xml'):] if '<?xml' in raw else raw)
            (output / f'{stem}.xml').write_text(raw, encoding='utf-8')
            return root
        time.sleep(2)
    raise RuntimeError('Fresh UI hierarchy unavailable: ' + label)


def label(node):
    return node.get('text', '') + ' ' + node.get('content-desc', '')


def find(root, text):
    return next((n for n in root.iter('node') if text in label(n)), None)


def tap(node):
    if node is None:
        raise RuntimeError('Expected UI control missing')
    coords = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
    if len(coords) != 4 or coords[2] <= coords[0] or coords[3] <= coords[1]:
        raise RuntimeError('Control has no usable bounds')
    adb('shell', 'input', 'tap', str((coords[0] + coords[2]) // 2),
        str((coords[1] + coords[3]) // 2))
    time.sleep(2)


def home(root):
    assert find(root, 'Your campus.') is not None, 'Home hero missing'
    assert find(root, 'Choose your station') is not None, 'Station section missing'


def start():
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    time.sleep(12)


recording = None
try:
    installed = adb('install', '-r', sys.argv[1], timeout=120)
    assert 'Success' in installed, installed
    adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.POST_NOTIFICATIONS')
    adb('shell', 'input', 'keyevent', '82')
    recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '180',
                                  '--size', '540x960', '/sdcard/signed-candidate.mp4'])
    start()
    root = snapshot('first-launch')
    if find(root, 'Continue without analytics') is not None:
        for _ in range(8):
            terms = find(root, 'I accept the Terms of Use.')
            if terms is not None:
                tap(terms)
                break
            bounds = list(map(int, re.findall(r'\d+', next(root.iter('node')).get('bounds'))))
            width, height = bounds[2], bounds[3]
            adb('shell', 'input', 'swipe', str(width // 2), str(height * 7 // 10),
                str(width // 2), str(height * 3 // 10), '350')
            time.sleep(1)
            root = snapshot('consent-scroll')
        else:
            raise RuntimeError('Terms checkbox not reachable')
        root = snapshot('terms-selected')
        tap(find(root, 'Continue without analytics'))
        time.sleep(8)
    root = snapshot('home')
    home(root)
    checks.append('Fresh guest launch; optional analytics declined')
    for tab in ('Podcasts', 'Radio', 'Home'):
        nodes = [n for n in root.iter('node') if re.match('^' + tab + r'(,|\s|$)', label(n))]
        assert nodes, 'Tab missing: ' + tab
        tap(nodes[-1])
        root = snapshot('tab-' + tab.lower())
        assert adb('shell', 'pidof', PACKAGE).strip(), 'App process missing'
    home(root)
    checks.append('Guest tab navigation; screenshots require visual review')
    for attempt in range(3):
        adb('shell', 'am', 'force-stop', PACKAGE)
        start()
        root = snapshot('restart-' + str(attempt + 1))
        home(root)
        assert find(root, 'Continue without analytics') is None, 'Consent was lost'
    checks.append('Three process restarts preserve guest consent and render home')
    adb('shell', 'settings', 'put', 'system', 'font_scale', '1.3')
    time.sleep(3)
    root = snapshot('large-font')
    home(root)
    checks.append('Home content present at 1.3 font scale; screenshot requires review')
    adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
    adb('shell', 'settings', 'put', 'system', 'user_rotation', '1')
    time.sleep(5)
    snapshot('landscape-requested')
    checks.append('Captured rotation request; actual orientation requires review')
    crashes = adb('logcat', '-d', '-b', 'crash')
    (output / 'crash-buffer.txt').write_text(crashes, encoding='utf-8')
    assert PACKAGE not in crashes, 'App entry in crash buffer; investigate'
    checks.append('No app entry in Android crash buffer')
    result = {'status': 'passed', 'checks': checks,
              'limits': ['Guest-only; no authenticated Gold, Auto, audio or release readiness claim',
                         'Screenshots and recording require human visual review']}
except Exception as error:
    result = {'status': 'failed', 'checks': checks, 'error': str(error)}
    raise
finally:
    (output / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    if recording is not None:
        adb('shell', 'pkill', '-2', 'screenrecord', check=False)
        recording.wait(timeout=20)
        adb('pull', '/sdcard/signed-candidate.mp4', str(output / 'session.mp4'), check=False)
