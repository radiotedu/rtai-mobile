"""Native Automotive media-host evidence. This is NOT Android Auto projection."""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
checks = []
recording = None
recording_name = 'automotive-setup'


def adb(*args, binary=False, check=True):
    return subprocess.run(['adb', *args], capture_output=True, text=not binary,
                          check=check, timeout=90).stdout


def capture(name):
    displays = adb('shell', 'dumpsys', 'SurfaceFlinger', '--display-id')
    (out / 'display-ids.txt').write_text(displays, encoding='utf-8')
    ids = re.findall(r'Display (\d+)', displays)
    assert ids, 'No explicit physical display ID found'
    png = adb('exec-out', 'screencap', '-p', '-d', ids[0], binary=True)
    assert png.startswith(b'\x89PNG\r\n\x1a\n'), 'Screen capture is not a clean PNG'
    (out / (name + '.png')).write_bytes(png)
    for attempt in range(4):
        remote = f'/sdcard/car-{name}-{attempt}.xml'
        adb('shell', 'uiautomator', 'dump', remote, check=False)
        xml = adb('shell', 'cat', remote, check=False)
        if '<hierarchy' in xml:
            (out / (name + '.xml')).write_text(xml, encoding='utf-8')
            return ET.fromstring(xml[xml.index('<?xml'):] if '<?xml' in xml else xml)
        time.sleep(2)
    raise RuntimeError('Fresh car-host UI unavailable: ' + name)


def find(root, title):
    for node in root.iter('node'):
        if title not in (node.get('text'), node.get('content-desc')):
            continue
        bounds = list(map(int, re.findall(r'-?\d+', node.get('bounds', ''))))
        if len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]:
            return bounds
    return None


def select(root, title):
    bounds = find(root, title)
    if bounds:
        adb('shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2),
            str((bounds[1] + bounds[3]) // 2))
        time.sleep(3)
        return
    raise RuntimeError('Car host item missing: ' + title)


def swipe(root, upward=True):
    # Automotive uses explicit paging controls; a drag can hit its player overlay.
    page = 'Scroll down' if upward else 'Scroll up'
    if find(root, page):
        select(root, page)
        return
    surface = next((n for n in root.iter('node') if n.get('scrollable') == 'true'), next(root.iter('node')))
    x1, y1, x2, y2 = map(int, re.findall(r'-?\d+', surface.get('bounds', '')))
    low, high = y1 + (y2 - y1) // 5, y1 + (y2 - y1) * 4 // 5
    start, end = (high, low) if upward else (low, high)
    adb('shell', 'input', 'swipe', str((x1 + x2) // 2), str(start), str((x1 + x2) // 2), str(end), '450')
    time.sleep(1)


def stop_recording():
    adb('shell', 'pkill', '-2', 'screenrecord', check=False)
    recording.wait(timeout=20)
    adb('pull', '/sdcard/' + recording_name + '.mp4', str(out / (recording_name + '.mp4')), check=False)


def select_id(root, resource):
    node = next(n for n in root.iter('node') if n.get('resource-id') == 'com.android.car.media:id/' + resource)
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
    assert node.get('enabled') == 'true' and x2 > x1 and y2 > y1, 'Unavailable control: ' + resource
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
    time.sleep(3)


def native_state(name, state, title=None):
    deadline = time.monotonic() + 60
    while True:
        media = adb('shell', 'dumpsys', 'media_session')
        audio = adb('shell', 'dumpsys', 'media.audio_flinger')
        sessions = [part for part in re.split(r'(?m)^    (?=\S)', media)
                    if part.startswith('androidx.media3.session.id.RadioTeduMediaLibrary com.radiotedumobile/')]
        pids = adb('shell', 'pidof', 'com.radiotedumobile').split()
        number = 3 if state == 'PLAYING' else 2
        matched = any(re.search(r'state=PlaybackState \{state=(' + state + r'\(' + str(number) + r'\)|' + str(number) + r'),', s)
                      and (title is None or title in s) for s in sessions)
        rendered = any(re.search(r'\byes\s+' + re.escape(pid) + r'\s', audio) for pid in pids)
        passed = matched and (state != 'PLAYING' or rendered)
        if passed or time.monotonic() >= deadline:
            break
        time.sleep(3)
    (out / (name + '-session.txt')).write_text(media, encoding='utf-8')
    (out / (name + '-audio.txt')).write_text(audio, encoding='utf-8')
    root = capture(name)
    assert passed, 'Native car state did not reach ' + state + ': ' + name
    return root


def select_first_catalog_title(root):
    toolbar = next(n for n in root.iter('node') if n.get('resource-id', '').endswith('/car_ui_toolbar_background'))
    top = int(re.findall(r'\d+', toolbar.get('bounds'))[3])
    controls = next((n for n in root.iter('node') if n.get('resource-id', '').endswith('/minimized_playback_controls')), None)
    bottom = int(re.findall(r'\d+', controls.get('bounds'))[1]) if controls is not None else 624
    for node in root.iter('node'):
        if node.get('resource-id') != 'com.android.car.media:id/title' or not node.get('text'):
            continue
        bounds = list(map(int, re.findall(r'\d+', node.get('bounds'))))
        if top < (bounds[1] + bounds[3]) // 2 < bottom:
            title = node.get('text')
            select(root, title)
            return title
    raise RuntimeError('No uncovered podcast catalog title available')


try:
    assert 'Success' in adb('install', '-r', sys.argv[1])
    adb('shell', 'pm', 'grant', 'com.radiotedumobile', 'android.permission.POST_NOTIFICATIONS')
    recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '180',
                                  '/sdcard/' + recording_name + '.mp4'])
    adb('shell', 'am', 'start', '-W', '-n', 'com.radiotedumobile/.MainActivity')
    time.sleep(15)
    root = capture('00-app-first-launch')
    for attempt in range(8):
        if find(root, 'I accept the Terms of Use.'):
            select(root, 'I accept the Terms of Use.')
            break
        swipe(root)
        root = capture('00-consent-scroll-' + str(attempt))
    else:
        raise RuntimeError('First-app consent checkbox not reachable')
    root = capture('00-terms-selected')
    select(root, 'Continue without analytics')
    time.sleep(20)
    root = capture('00-app-initialized')
    if any(n.get('text', '').startswith('Allow RadioTEDU to send') for n in root.iter('node')):
        select(root, 'Allow')
        root = capture('00-app-notifications-allowed')
    assert any('Your campus.' in n.get('text', '') for n in root.iter('node')), 'Guest home not initialized'
    checks.append('First app setup completed as guest with optional analytics declined')
    launch = adb('shell', 'am', 'start', '-W', '-a', 'android.car.intent.action.MEDIA_TEMPLATE',
                 '--es', 'android.car.intent.extra.MEDIA_COMPONENT',
                 'com.radiotedumobile/com.radiotedumobile.car.RadioTeduCarService')
    (out / 'host-launch.txt').write_text(launch, encoding='utf-8')
    time.sleep(20)
    root = capture('01-car-root')
    select(root, 'Live Radio')
    checks.append('Native car host displays Live Radio category')
    stop_recording()
    recording = None
    recording_name = 'automotive-catalog-lofi'
    recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '180',
                                  '/sdcard/' + recording_name + '.mp4'])
    root = capture('02-station-list')
    expected = {'RadioTEDU'} | {'RadioTEDU ' + name for name in
                               ('Classical', 'Jazz', 'Lo-Fi', 'Energize', 'Rock', 'English', 'Français', 'Voting')}
    seen = set()
    for attempt in range(8):
        seen.update(title for title in expected if find(root, title))
        if seen == expected:
            break
        swipe(root)
        root = capture('02-catalog-scroll-' + str(attempt))
    (out / 'catalog-stations.json').write_text(json.dumps(sorted(seen), ensure_ascii=False), encoding='utf-8')
    assert seen == expected, 'Car catalog missing: ' + ', '.join(sorted(expected - seen))
    checks.append('Initialized car catalog contains all nine stations, including Lo-Fi')
    for attempt in range(8):
        bounds = find(root, 'RadioTEDU Lo-Fi')
        if bounds:
            toolbar = next(n for n in root.iter('node') if n.get('resource-id', '').endswith('/car_ui_toolbar_background'))
            controls = next(n for n in root.iter('node') if n.get('resource-id', '').endswith('/minimized_playback_controls'))
            top = int(re.findall(r'\d+', toolbar.get('bounds'))[3])
            bottom = int(re.findall(r'\d+', controls.get('bounds'))[1])
            center = (bounds[1] + bounds[3]) // 2
            if top < center < bottom:
                select(root, 'RadioTEDU Lo-Fi')
                break
            # Move the row away from the host's transparent toolbar/player overlays.
            middle = (top + bottom) // 2
            shift = 130 if center <= top else -130
            adb('shell', 'input', 'swipe', '600', str(middle), '600', str(middle + shift), '450')
            time.sleep(2)
        else:
            swipe(root, upward=False)
        root = capture('02-find-lofi-' + str(attempt))
    else:
        raise RuntimeError('Lo-Fi could not be reached for playback')
    deadline = time.monotonic() + 60
    while True:
        media = adb('shell', 'dumpsys', 'media_session')
        audio = adb('shell', 'dumpsys', 'media.audio_flinger')
        sessions = [part for part in re.split(r'(?m)^    (?=\S)', media)
                    if part.startswith('androidx.media3.session.id.RadioTeduMediaLibrary com.radiotedumobile/')]
        pids = adb('shell', 'pidof', 'com.radiotedumobile').split()
        playing = any(re.search(r'state=PlaybackState \{state=(PLAYING\(3\)|3),', s) for s in sessions)
        active = any(re.search(r'\byes\s+' + re.escape(pid) + r'\s', audio) for pid in pids)
        if (playing and active) or time.monotonic() >= deadline:
            break
        time.sleep(3)
    (out / 'car-media-session.txt').write_text(media, encoding='utf-8')
    (out / 'car-rendered-audio.txt').write_text(audio, encoding='utf-8')
    capture('03-car-playing')
    assert playing and active, 'Native car playback session/rendered audio not established'
    checks.append('Native car host starts Lo-Fi with active rendered audio track')
    stop_recording()
    recording = None
    recording_name = 'automotive-controls-podcast'
    recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '180',
                                  '/sdcard/' + recording_name + '.mp4'])
    root = capture('04-before-pause')
    select_id(root, 'play_pause_stop')
    root = native_state('05-car-paused', 'PAUSED')
    select_id(root, 'play_pause_stop')
    root = native_state('06-car-resumed', 'PLAYING')
    checks.append('Native car touch controls pause and resume rendered radio playback')
    select(root, 'Back')
    root = capture('07-car-browse')
    select(root, 'Podcasts')
    root = capture('08-car-podcast-series')
    series_title = select_first_catalog_title(root)
    root = capture('09-car-podcast-episodes')
    episode_title = select_first_catalog_title(root)
    root = native_state('10-car-podcast-playing', 'PLAYING', episode_title)
    (out / 'podcast-selection.json').write_text(json.dumps({'series': series_title, 'episode': episode_title}, ensure_ascii=False), encoding='utf-8')
    checks.append('Native car browses podcast series and plays selected episode with matching metadata and rendered audio')
    select_id(root, 'play_pause_stop')
    native_state('11-car-podcast-paused', 'PAUSED', episode_title)
    checks.append('Native car touch control pauses selected podcast')
    result = {'status': 'passed', 'checks': checks,
              'limits': ['Automotive host only; Android Auto projection remains unverified',
                         'One podcast episode and radio pause/resume tested; no complete car-control or lifecycle coverage',
                         'No authenticated data, Gold or physical speaker claim']}
except Exception as error:
    result = {'status': 'failed', 'checks': checks, 'error': str(error)}
    raise
finally:
    (out / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    # Disposable guest emulator only. Keep diagnostics separate from publication assets.
    for name, command in [
        ('catalog-runtime-log.txt', ('logcat', '-d', '-s', 'ReactNativeJS:I', 'RadioTeduCarService:I')),
        ('car-user.txt', ('shell', 'am', 'get-current-user')),
        ('car-services.txt', ('shell', 'dumpsys', 'activity', 'services', 'com.radiotedumobile')),
    ]:
        try:
            (out / name).write_text(adb(*command, check=False), encoding='utf-8')
        except Exception as diagnostic_error:
            print('Diagnostic unavailable:', name, type(diagnostic_error).__name__)
    if recording is not None:
        stop_recording()
