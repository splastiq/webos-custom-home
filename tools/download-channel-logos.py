"""Bundle playlist HD logos locally for offline use; no runtime dependency."""
import json
import re
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[1]
folder = root / 'app' / 'logos'
folder.mkdir(exist_ok=True)
logos = {}
for line in (root / 'app' / 'channels.m3u').read_text().splitlines():
    if not line.startswith('#EXTINF:'):
        continue
    height = re.search(r'\((\d+)p\)', line)
    if not height or int(height[1]) < 720:
        continue
    ident = re.search(r'tvg-id="([^"]+)"', line)[1]
    url = re.search(r'tvg-logo="([^"]+)"', line)[1]
    filename = re.sub(r'[^A-Za-z0-9._-]', '_', ident) + '.png'
    dest = folder / filename
    result = subprocess.run(['curl', '-L', '--fail', '--silent', '--show-error', '--max-time', '20', url, '-o', str(dest)])
    if result.returncode == 0:
        data = dest.read_bytes()
        if data.startswith(b'\x89PNG'):
            logos[ident] = 'logos/' + filename
        elif data.startswith(b'\xff\xd8'):
            jpeg = dest.with_suffix('.jpg')
            dest.rename(jpeg)
            logos[ident] = 'logos/' + jpeg.name
        else:
            print('Unsupported image:', ident)
    else:
        print('Download failed:', ident)
(root / 'app' / 'channel-logos.js').write_text('/* Bundled logos from tvg-logo metadata in channels.m3u. */\nwindow.CHANNEL_LOGOS = ' + json.dumps(logos, indent=2) + ';\n')
print('Bundled logos:', len(logos))
