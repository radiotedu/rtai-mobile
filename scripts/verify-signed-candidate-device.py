"""Guest-only runtime evidence from a disposable CI emulator; never an Auto/Gold gate."""
import json
from pathlib import Path
import re
import subprocess
import struct
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
    return next((n for n in root.iter('node') if text in label(n) and usable(n)), None)


def usable(node):
    coords = list(map(int, re.findall(r'-?\d+', node.get('bounds', ''))))
    return len(coords) == 4 and coords[2] > coords[0] and coords[3] > coords[1]


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


def audio_state(label, expected='PLAYING', timeout=60):
    """Require this app's session and active AudioFlinger client, not another player."""
    deadline = time.monotonic() + timeout
    while True:
        media = adb('shell', 'dumpsys', 'media_session')
        audio = adb('shell', 'dumpsys', 'media.audio_flinger')
        pids = adb('shell', 'pidof', PACKAGE).split()
        sessions = [part for part in re.split(r'(?m)^\s+package=', media)
                    if part.startswith(PACKAGE + '\n')]
        state_ok = any(re.search(r'state=PlaybackState \{state=' + expected + r'\(', part)
                       for part in sessions)
        track_ok = any(re.search(r'\byes\s+' + re.escape(pid) + r'\s', audio) for pid in pids)
        if state_ok and (expected != 'PLAYING' or track_ok):
            break
        if time.monotonic() >= deadline:
            (output / f'{label}-media.txt').write_text(media, encoding='utf-8')
            (output / f'{label}-audio.txt').write_text(audio, encoding='utf-8')
            raise RuntimeError(f'{label}: expected {expected} app session/rendered audio')
        time.sleep(3)
    (output / f'{label}-media.txt').write_text(media, encoding='utf-8')
    (output / f'{label}-audio.txt').write_text(audio, encoding='utf-8')
    checks.append(label + ': ' + expected + (' with active app AudioFlinger track' if expected == 'PLAYING' else ''))


def stop_recording(process, name):
    adb('shell', 'pkill', '-2', 'screenrecord', check=False)
    process.wait(timeout=20)
    adb('pull', '/sdcard/' + name + '.mp4', str(output / (name + '.mp4')), check=False)


def save_share_png(shape):
    root = snapshot('share-preview-' + shape)
    tap(find(root, 'Save PNG'))
    root = snapshot('share-file-picker-' + shape)
    name = next((n.get('text') for n in root.iter('node')
                 if n.get('class') == 'android.widget.EditText' and n.get('text', '').endswith('.png')), None)
    assert name and '/' not in name, 'PNG save filename missing'
    button = next((n for n in root.iter('node') if n.get('text', '').upper() == 'SAVE' and usable(n)), None)
    tap(button)
    remote = '/sdcard/Download/' + name
    for _ in range(15):
        size = adb('shell', 'stat', '-c', '%s', remote, check=False).strip()
        if size.isdigit() and int(size) > 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError('Native share PNG was not written')
    path = output / ('now-playing-' + shape + '.png')
    assert not path.exists(), 'Preserve earlier export'
    adb('pull', remote, str(path))
    data = path.read_bytes()
    assert data.startswith(b'\x89PNG\r\n\x1a\n') and data[-8:-4] == b'IEND', 'Invalid PNG envelope'
    dimensions = struct.unpack('>II', data[16:24])
    assert dimensions == ((1080, 1920) if shape == 'story' else (1080, 1080)), dimensions
    checks.append('Native now-playing ' + shape + ' PNG saved at ' + str(dimensions))


recording = None
recording_name = 'signed-candidate'
try:
    installed = adb('install', '-r', sys.argv[1], timeout=120)
    assert 'Success' in installed, installed
    adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.POST_NOTIFICATIONS')
    adb('shell', 'input', 'keyevent', '82')
    recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '180',
                                  '--size', '540x960', '/sdcard/signed-candidate.mp4'])
    start()
    root = snapshot('first-launch')
    for attempt in range(3):
        if find(root, "Pixel Launcher isn't responding") is None:
            break
        checks.append('Environment: Pixel Launcher ANR; closed hung launcher')
        tap(find(root, 'Close app'))
        start()
        root = snapshot('launcher-recovery-' + str(attempt + 1))
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
    if '--media' in sys.argv:
        stop_recording(recording, recording_name)
        recording = None
        recording_name = 'radio-background-offline'
        recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '180',
                                      '--size', '540x960', '/sdcard/' + recording_name + '.mp4'])
        adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0')
        adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
        start()
        root = snapshot('before-radio')
        tap(find(root, 'Listen live'))
        audio_state('radio-playing')
        snapshot('radio-player-artwork-lyrics')
        adb('shell', 'input', 'keyevent', '3')
        time.sleep(5)
        audio_state('background-playing')
        adb('shell', 'input', 'keyevent', '127')
        audio_state('background-paused', 'PAUSED')
        adb('shell', 'input', 'keyevent', '126')
        audio_state('background-resumed')
        adb('shell', 'svc', 'wifi', 'disable')
        adb('shell', 'svc', 'data', 'disable')
        time.sleep(8)
        start()
        snapshot('radio-offline')
        adb('shell', 'svc', 'wifi', 'enable')
        adb('shell', 'svc', 'data', 'enable')
        audio_state('radio-online-recovered')
        snapshot('radio-recovered')
        adb('shell', 'input', 'keyevent', '127')
        audio_state('radio-final-paused', 'PAUSED')
        root = snapshot('before-image-share')
        tap(find(root, 'Share'))
        save_share_png('story')
        root = snapshot('before-square-share')
        tap(find(root, 'Square'))
        save_share_png('square')
    crashes = adb('logcat', '-d', '-b', 'crash')
    (output / 'crash-buffer.txt').write_text(crashes, encoding='utf-8')
    assert PACKAGE not in crashes, 'App entry in crash buffer; investigate'
    checks.append('No app entry in Android crash buffer')
    result = {'status': 'passed', 'checks': checks,
              'limits': ['Guest-only; no authenticated Gold, Auto or release readiness claim',
                         'Audio checks run only with --media; they verify rendered tracks, not physical speaker output',
                         'Screenshots and recording require human visual review']}
except Exception as error:
    result = {'status': 'failed', 'checks': checks, 'error': str(error)}
    raise
finally:
    (output / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    if recording is not None:
        stop_recording(recording, recording_name)
