"""Prepare small offline thumbnails from Apple manifest metadata (macOS sips)."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import json, subprocess, tempfile, sys
root = Path(__file__).resolve().parents[1]
manifest = json.loads(Path(sys.argv[1]).read_text())
folder = root / 'app/aerial-thumbs'
folder.mkdir(exist_ok=True)
def prepare(asset):
    target = folder / (asset['id'] + '.jpg')
    if target.exists(): return asset['id'], True
    url = asset.get('previewImage') or asset.get('previewImage-900x580')
    if not url or not url.startswith('https://sylvan.apple.com/'): return asset['id'], False
    with tempfile.TemporaryDirectory(prefix='home-aerial-') as temporary:
        source = Path(temporary) / 'preview.png'
        result = subprocess.run(['curl','-fsSL','--connect-timeout','6','--max-time','25','--retry','1',url,'-o',str(source)],capture_output=True)
        if result.returncode: return asset['id'], False
        result = subprocess.run(['sips','-s','format','jpeg','-s','formatOptions','65','--resampleHeightWidthMax','400',str(source),'--out',str(target)],capture_output=True)
        return asset['id'], result.returncode == 0
failed = []
with ThreadPoolExecutor(max_workers=4) as pool:
    for count, future in enumerate(as_completed([pool.submit(prepare, asset) for asset in manifest['assets']]), 1):
        asset_id, success = future.result()
        if not success: failed.append(asset_id)
        if count % 20 == 0: print('Prepared', count, 'of', len(manifest['assets']), flush=True)
p = root / 'app/aerial-assets.js'
text = p.read_text()
data = json.loads(text.split('window.HOME_AERIAL_ASSETS = ',1)[1].rstrip().rstrip(';'))
for asset in data['assets']:
    if (folder / (asset['id'] + '.jpg')).exists(): asset['previewLocal'] = 'aerial-thumbs/' + asset['id'] + '.jpg'
p.write_text(text.split('window.HOME_AERIAL_ASSETS = ',1)[0] + 'window.HOME_AERIAL_ASSETS = ' + json.dumps(data,ensure_ascii=True,indent=2) + ';\n')
print('Thumbnail bytes:',sum(p.stat().st_size for p in folder.glob('*.jpg')), 'Failures:',failed)
