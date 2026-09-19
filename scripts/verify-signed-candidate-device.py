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
    profiles = [n for n in root.iter('node') if n.get('content-desc') == 'Profile' and n.get('clickable') == 'true']
    assert len(profiles) == 1, 'English Home must expose one translated Profile button'
    density = re.findall(r'(?:Physical|Override) density: (\d+)', adb('shell', 'wm', 'density'))
    assert density, 'Display density unavailable'
    minimum = 48 * int(density[-1]) / 160
    left, top, right, bottom = map(int, re.findall(r'-?\d+', profiles[0].get('bounds', '')))
    assert right - left >= minimum and bottom - top >= minimum, 'Profile target smaller than 48dp'


def transport_controls(root):
    density_output = adb('shell', 'wm', 'density')
    densities = re.findall(r'(?:Physical|Override) density: (\d+)', density_output)
    assert densities, 'Device display density unavailable'
    minimum = 48 * int(densities[-1]) / 160
    control_tops = []
    for title in ('Previous', 'Pause', 'Next'):
        matches = []
        def visit(node, scrolling=False):
            scrolling = scrolling or node.get('scrollable') == 'true'
            if node.get('content-desc') == title and node.get('clickable') == 'true':
                matches.append((node, scrolling))
            for child in node:
                visit(child, scrolling)
        visit(root)
        assert len(matches) == 1, title + ': expected one transport control'
        node, scrolling = matches[0]
        assert not scrolling, title + ': transport remains inside scrolling content'
        x1, y1, x2, y2 = map(int, re.findall(r'-?\d+', node.get('bounds', '')))
        assert x2-x1 >= minimum and y2-y1 >= minimum, title + ': touch target clipped or below 48dp'
        control_tops.append(y1)
    png = adb('exec-out', 'screencap', '-p', binary=True)
    width, height = struct.unpack('>II', png[16:24])
    def identified(name):
        return [node for node in root.iter('node') if node.get('resource-id', '').split('/')[-1] == name]
    for name in ('player-station-name', 'player-track-title', 'player-track-artist'):
        matches = identified(name)
        assert len(matches) == 1, name + ': missing or duplicated'
        node = matches[0]
        assert label(node).strip(), name + ': empty text'
        x1, y1, x2, y2 = map(int, re.findall(r'-?\d+', node.get('bounds', '')))
        assert 0 <= x1 < x2 <= width and 0 <= y1 < y2 <= min(control_tops), name + ': outside visible content area'
        assert y2-y1 >= minimum / 4, name + ': text clipped to a sliver'
    panels = identified('player-lyrics-panel')
    if panels:
        assert len(panels) == 1, 'Multiple lyrics cards'
        panel = panels[0]
        x1, y1, x2, y2 = map(int, re.findall(r'-?\d+', panel.get('bounds', '')))
        assert 0 <= x1 < x2 <= width and 0 <= y1 < y2 <= min(control_tops), 'Lyrics card extends under controls'
        assert y2-y1 >= minimum * 78 / 48, 'Lyrics card cannot fit its header and one line'
        parents = {child: parent for parent in root.iter() for child in parent}
        while panel in parents:
            panel = parents[panel]
            assert panel.get('scrollable') != 'true', 'Lyrics card is clipped by an outer scroller'
    checks.append('Visible station/song/artist; ' + ('complete lyrics card outside outer scrolling content' if panels else 'lyrics card absent in this capture'))


def orient_screen(landscape, validator=home, prefix=''):
    # Tablets may have a landscape natural orientation. Rotation=1 alone
    # therefore does not prove a landscape viewport.
    adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
    for rotation in (0, 1):
        adb('shell', 'settings', 'put', 'system', 'user_rotation', str(rotation))
        time.sleep(5)
        png = adb('exec-out', 'screencap', '-p', binary=True)
        assert png[:8] == b'\x89PNG\r\n\x1a\n', 'Invalid orientation screenshot'
        width, height = struct.unpack('>II', png[16:24])
        if width != height and (width > height) == landscape:
            name = prefix + ('landscape' if landscape else 'portrait')
            (output / (name + '-dimensions.json')).write_text(
                json.dumps({'width': width, 'height': height, 'rotation': rotation}), encoding='utf-8')
            root = snapshot(name + '-verified')
            validator(root)
            return
    raise AssertionError('Device did not enter requested orientation')


def start():
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    time.sleep(12)


def configure_player_font(scale):
    # Android can recreate the activity when the system font changes.
    # Reopen the player from the resulting Home screen before inspecting it.
    adb('shell', 'settings', 'put', 'system', 'font_scale', str(scale))
    start()
    root = snapshot('font-configured-' + str(scale))
    button = find(root, 'Listen live')
    if button is not None:
        tap(button)
    audio_state('font-' + str(scale) + '-playing')
    transport_controls(snapshot('font-' + str(scale) + '-controls'))


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
    tap(find(root, 'Save'))
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
    orient_screen(True)
    checks.append('Landscape dimensions verified with home content present; layout needs visual review')
    if '--media' in sys.argv:
        stop_recording(recording, recording_name)
        recording = None
        recording_name = 'player-layout-playback'
        recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '180',
                                      '--size', '540x960', '/sdcard/' + recording_name + '.mp4'])
        adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0')
        orient_screen(False)
        start()
        root = snapshot('before-radio')
        tap(find(root, 'Listen live'))
        audio_state('radio-playing')
        transport_controls(snapshot('radio-player-artwork-lyrics'))
        configure_player_font(1.3)
        orient_screen(True, transport_controls, 'player-')
        orient_screen(False, transport_controls, 'player-')
        configure_player_font(1.0)
        checks.append('Transport controls stay outside scrolling content with at least 48dp touch targets at large font size in both actual orientations')
        stop_recording(recording, recording_name)
        recording = None
        recording_name = 'radio-background-offline'
        recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '180',
                                      '--size', '540x960', '/sdcard/' + recording_name + '.mp4'])
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
        # Live lyrics can disappear during a station jingle, moving the player
        # controls between the dump and tap. Retry only from a fresh tree and
        # require the actual PNG composer before proceeding.
        for attempt in range(3):
            button = next((n for n in root.iter('node')
                           if n.get('content-desc') == 'Share' and usable(n)), None)
            tap(button)
            root = snapshot('image-share-open-' + str(attempt))
            if find(root, 'Save') is not None:
                break
        assert find(root, 'Save') is not None, 'PNG composer did not open after fresh-coordinate retries'
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
    try:
        (output / 'guest-system-log.txt').write_text(
            adb('logcat', '-d', '-t', '2500', check=False), encoding='utf-8')
    except Exception as diagnostic_error:
        print('System diagnostic unavailable:', type(diagnostic_error).__name__)
    if recording is not None:
        stop_recording(recording, recording_name)
