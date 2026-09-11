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


def select(root, title):
    for node in root.iter('node'):
        if title not in (node.get('text'), node.get('content-desc')):
            continue
        bounds = list(map(int, re.findall(r'-?\d+', node.get('bounds', ''))))
        if len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]:
            adb('shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2),
                str((bounds[1] + bounds[3]) // 2))
            time.sleep(8)
            return
    raise RuntimeError('Car host item missing: ' + title)


try:
    assert 'Success' in adb('install', '-r', sys.argv[1])
    recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '180',
                                  '/sdcard/automotive-host.mp4'])
    launch = adb('shell', 'am', 'start', '-W', '-a', 'android.car.intent.action.MEDIA_TEMPLATE',
                 '--es', 'android.car.intent.extra.MEDIA_COMPONENT',
                 'com.radiotedumobile/com.radiotedumobile.car.RadioTeduCarService')
    (out / 'host-launch.txt').write_text(launch, encoding='utf-8')
    time.sleep(20)
    root = capture('01-car-root')
    select(root, 'Live Radio')
    checks.append('Native car host displays Live Radio category')
    root = capture('02-station-list')
    select(root, 'RadioTEDU')
    deadline = time.monotonic() + 60
    while True:
        media = adb('shell', 'dumpsys', 'media_session')
        audio = adb('shell', 'dumpsys', 'media.audio_flinger')
        sessions = [part for part in re.split(r'(?m)^\s+package=', media)
                    if part.startswith('com.radiotedumobile\n')]
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
    checks.append('Native car host starts RadioTEDU with active rendered audio track')
    result = {'status': 'passed', 'checks': checks,
              'limits': ['Automotive host only; Android Auto projection remains unverified',
                         'No authenticated data, Gold, physical speaker or complete car catalog claim']}
except Exception as error:
    result = {'status': 'failed', 'checks': checks, 'error': str(error)}
    raise
finally:
    (out / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    if recording is not None:
        adb('shell', 'pkill', '-2', 'screenrecord', check=False)
        recording.wait(timeout=20)
        adb('pull', '/sdcard/automotive-host.mp4', str(out / 'automotive-host.mp4'), check=False)
