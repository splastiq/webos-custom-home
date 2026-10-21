"""Read original PNG border pixels and bake tile colors without TV canvas work."""
from pathlib import Path
from collections import Counter
import struct
import zlib
root = Path(__file__).resolve().parents[1]
colors = {}
for file in (root / 'app/app-icons').glob('*.png'):
    data = file.read_bytes()
    pos = 8
    compressed = b''
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos+4])[0]
        tag = data[pos+4:pos+8]
        body = data[pos+8:pos+8+length]
        if tag == b'IHDR':
            width, height, depth, kind, _, _, interlaced = struct.unpack('>IIBBBBB', body)
            assert (depth, kind, interlaced) == (8, 6, 0)
        if tag == b'IDAT':
            compressed += body
        pos += length + 12
    raw = zlib.decompress(compressed)
    stride = width * 4
    previous = bytearray(stride)
    counts = Counter()
    buckets = {}
    for y in range(height):
        start = y * (stride + 1)
        mode = raw[start]
        row = bytearray(raw[start+1:start+1+stride])
        for i in range(stride):
            left = row[i-4] if i >= 4 else 0
            above = previous[i]
            corner = previous[i-4] if i >= 4 else 0
            if mode == 1: predictor = left
            elif mode == 2: predictor = above
            elif mode == 3: predictor = (left + above) // 2
            elif mode == 4:
                p = left + above - corner
                distances = [abs(p-left), abs(p-above), abs(p-corner)]
                predictor = [left, above, corner][distances.index(min(distances))]
            else: predictor = 0
            row[i] = (row[i] + predictor) & 255
        for x in range(width):
            # Inner perimeter avoids anti-aliased rounded corners.
            if not (10 <= x < width-10 and 10 <= y < height-10): continue
            if not (x < 24 or x >= width-24 or y < 24 or y >= height-24): continue
            r,g,b,a = row[x*4:x*4+4]
            if a < 240: continue
            key = (r//16, g//16, b//16)
            counts[key] += 1
            buckets.setdefault(key, []).append((r,g,b))
        previous = row
    bucket = buckets[counts.most_common(1)[0][0]]
    color = '#'+''.join('%02x' % round(sum(p[i] for p in bucket)/len(bucket)) for i in range(3))
    colors[file.stem] = color
if (root / 'app/app-icons/youtube.svg').exists():
    colors['youtube'] = '#ffffff'
css = '\n'.join('.app-tile[data-app-key="%s"] .tile-art{background:%s}' % pair for pair in sorted(colors.items()))
(root / 'app/app-colors.css').write_text('/* Generated from original icon border colors. */\n'+css+'\n')
print(colors)
