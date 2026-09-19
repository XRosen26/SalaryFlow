from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
GREEN = (22, 107, 82, 255)
GREEN_DARK = (14, 82, 63, 255)
WHITE = (248, 252, 250, 255)
MINT = (177, 229, 207, 255)
CURVES = [
    ((704, 250), (624, 182), (398, 180), (318, 298)),
    ((318, 298), (220, 442), (418, 482), (542, 512)),
    ((542, 512), (724, 554), (790, 664), (686, 776)),
    ((686, 776), (590, 874), (360, 848), (278, 758)),
]

def cubic(p0, p1, p2, p3, t):
    u = 1.0 - t
    return (
        u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
        u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
    )

def flow_points(scale=1.0, offset=(0, 0)):
    result = []
    for index, curve in enumerate(CURVES):
        for step in range(25):
            if index and step == 0:
                continue
            x, y = cubic(*curve, step / 24)
            result.append((round(x * scale + offset[0]), round(y * scale + offset[1])))
    return result

def draw_icon(size, transparent=False, adaptive=False, monochrome=False):
    ss = 4
    canvas = size * ss
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if not transparent:
        inset = round(canvas * 0.018)
        radius = round(canvas * 0.218)
        draw.rounded_rectangle(
            (inset, inset, canvas - inset, canvas - inset),
            radius=radius,
            fill=GREEN,
        )
        draw.arc(
            (round(canvas*.08), round(canvas*.06), round(canvas*.92), round(canvas*.90)),
            208, 326, fill=GREEN_DARK, width=max(1, round(canvas*.018))
        )
    if adaptive:
        scale = canvas / 1024 * 0.70
        offset = (canvas * 0.15, canvas * 0.15)
        width = round(96 * scale)
    else:
        scale = canvas / 1024
        offset = (0, 0)
        width = round(96 * scale)
    pts = flow_points(scale, offset)
    draw.line(pts, fill=WHITE, width=width, joint="curve")
    radius = width // 2
    for x, y in (pts[0], pts[-1]):
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=WHITE)
    if not monochrome:
        dot = max(2, round(width * .16))
        for x, y in (pts[0], pts[-1]):
            draw.ellipse((x-dot, y-dot, x+dot, y+dot), fill=MINT)
    return image.resize((size, size), Image.Resampling.LANCZOS)

build = ROOT / "build"
assets = ROOT / "mobile" / "assets" / "images"
build.mkdir(parents=True, exist_ok=True)
assets.mkdir(parents=True, exist_ok=True)
desktop = draw_icon(512)
desktop.save(build / "icon.png", optimize=True)
desktop.save(
    build / "icon.ico",
    sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)],
)
draw_icon(1024).save(assets / "icon.png", optimize=True)
draw_icon(256).save(assets / "favicon.png", optimize=True)
draw_icon(1024).save(assets / "splash-icon.png", optimize=True)
draw_icon(1024, transparent=True, adaptive=True).save(
    assets / "android-icon-foreground.png", optimize=True
)
Image.new("RGBA", (1024, 1024), GREEN).save(
    assets / "android-icon-background.png", optimize=True
)
draw_icon(1024, transparent=True, adaptive=True, monochrome=True).save(
    assets / "android-icon-monochrome.png", optimize=True
)
print("Generated SalaryFlow desktop, Android, iOS, splash and web icons.")
