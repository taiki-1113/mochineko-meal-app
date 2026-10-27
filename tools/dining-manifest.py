"""Read atlas alpha bounds; do not alter or resample production images."""
import json
from collections import deque
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
result = {"stages": {}, "plates": []}
def subject_box(alpha):
    """Ignore disconnected scraps from neighboring atlas cells, read-only."""
    w, h = alpha.size
    mask = bytearray(1 if a > 128 else 0 for a in alpha.getdata())
    largest, bounds = 0, None
    for start in range(w*h):
        if not mask[start]:
            continue
        mask[start] = 0
        queue, count = deque([start]), 0
        x0, x1, y0, y1 = w, 0, h, 0
        while queue:
            p = queue.popleft()
            x, y = p % w, p // w
            count += 1
            x0, x1, y0, y1 = min(x0,x), max(x1,x), min(y0,y), max(y1,y)
            for n in (p-1 if x else -1,p+1 if x<w-1 else -1,p-w,p+w):
                if 0 <= n < w*h and mask[n]:
                    mask[n] = 0
                    queue.append(n)
        if count > largest:
            largest, bounds = count, (x0,y0,x1+1,y1+1)
    return bounds
for group, name in enumerate(("early", "middle", "late")):
    im = Image.open(root / f"assets/dining/{name}.png")
    w, h = im.size
    for col in range(3):
        frames = []
        left, right = round(w*col/3), round(w*(col+1)/3)
        column = im.getchannel("A").crop((left, 0, right, h))
        pixels, cw = column.load(), right-left
        # Generated atlas rows have natural gutters, not exact mathematical thirds.
        # Locate those gutters so tilted ears remain intact.
        cuts=[0]
        for fraction in (1/3,2/3):
            candidates=range(round(h*(fraction-.045)),round(h*(fraction+.045)))
            counts={y:sum(pixels[x,y]>128 for x in range(cw)) for y in candidates}
            minimum=min(counts.values())
            best=[y for y in candidates if counts[y]<=minimum+2]
            cuts.append(best[len(best)//2])
        cuts.append(h)
        for row in range(3):
            top, bottom = cuts[row], cuts[row+1]
            alpha = im.getchannel("A").crop((left, top, right, bottom))
            box = subject_box(alpha)
            x0, y0, x1, y1 = box
            x0, y0 = max(0, x0-2), max(0, y0-2)
            x1, y1 = min(right-left, x1+2), min(bottom-top, y1+2)
            frames.append({"box": [left+x0, top+y0, x1-x0, y1-y0]})
        result["stages"][str(group*3+col+1)] = {"file": f"./assets/dining/{name}.png", "width": w, "height": h, "frames": frames}
im = Image.open(root / "assets/dining/plates.png")
w, h = im.size
result["plateSize"] = [w, h]
for col in range(3):
    left, right = round(w*col/3), round(w*(col+1)/3)
    a = im.getchannel("A").crop((left, 0, right, h))
    x0, y0, x1, y1 = a.point(lambda v: 255 if v > 128 else 0).getbbox()
    result["plates"].append([left+x0, y0, x1-x0, y1-y0])
(root / "assets/dining/manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print(json.dumps({"stages": len(result["stages"]), "poses": 27, "plateStates": len(result["plates"])}))
