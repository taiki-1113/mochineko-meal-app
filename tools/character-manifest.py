"""Read image alpha bounds for SVG positioning; never alter source pixels."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1] / 'assets' / 'character'
manifest = {}
for file in sorted(root.glob('stage-*.png')):
    image = Image.open(file)
    bounds = image.getchannel('A').point(lambda value: 255 if value > 48 else 0).getbbox()
    x, y = max(0, bounds[0] - 6), max(0, bounds[1] - 6)
    right, bottom = min(image.width, bounds[2] + 6), min(image.height, bounds[3] + 6)
    manifest[file.stem[-2:]] = {'width':image.width, 'height':image.height, 'box':[x,y,right-x,bottom-y]}
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Read alpha bounds for {len(manifest)} stages')
