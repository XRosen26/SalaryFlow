from pathlib import Path
from PIL import Image, ImageDraw

MOBILE = Path(__file__).resolve().parents[1] / "assets" / "images"
ROOT = Path(__file__).resolve().parents[2]
GREEN = "#155F4B"
GREEN_DARK = "#0F4739"
MINT = "#A7E2CA"
WHITE = "#FFFFFF"
SCALE = 4


def cubic(p0, p1, p2, p3, steps=52):
    points = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        points.append((
            u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1],
        ))
    return points


def flow_points(size):
    s = size / 1024
    raw = []
    segments = [
        ((730, 242), (565, 145), (315, 238), (382, 418)),
        ((382, 418), (425, 535), (715, 475), (646, 629)),
        ((646, 629), (590, 755), (405, 825), (294, 774)),
    ]
    for index, segment in enumerate(segments):
        pts = cubic(*segment)
        raw.extend(pts if index == 0 else pts[1:])
    return [(round(x*s), round(y*s)) for x, y in raw]


def draw_mark(draw, size, primary=WHITE, shadow=MINT):
    points = flow_points(size)
    shadow_width = round(size * 0.092)
    line_width = round(size * 0.060)
    draw.line(points, fill=shadow, width=shadow_width, joint="curve")
    draw.line(points, fill=primary, width=line_width, joint="curve")
    radius = round(size * 0.040)
    for x, y in (points[0], points[-1]):
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=primary)


def downsample(image):
    return image.resize((1024, 1024), Image.Resampling.LANCZOS)


def full_icon():
    size = 1024*SCALE
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    margin = 62*SCALE
    d.rounded_rectangle((margin, margin, size-margin, size-margin), radius=224*SCALE, fill=GREEN)
    d.rounded_rectangle((104*SCALE, 104*SCALE, 920*SCALE, 920*SCALE), radius=190*SCALE, outline=GREEN_DARK, width=12*SCALE)
    draw_mark(d, size)
    return downsample(im)


def transparent_mark(primary=WHITE, shadow=MINT):
    size = 1024*SCALE
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_mark(ImageDraw.Draw(im), size, primary, shadow)
    return downsample(im)


MOBILE.mkdir(parents=True, exist_ok=True)
icon = full_icon()
icon.save(MOBILE / "icon.png")
icon.save(MOBILE / "favicon.png")
transparent_mark().save(MOBILE / "android-icon-foreground.png")
Image.new("RGBA", (1024, 1024), GREEN).save(MOBILE / "android-icon-background.png")
transparent_mark(WHITE, WHITE).save(MOBILE / "android-icon-monochrome.png")
transparent_mark().save(MOBILE / "splash-icon.png")
(ROOT / "build").mkdir(parents=True, exist_ok=True)
icon.save(ROOT / "build" / "icon.png")
icon.save(ROOT / "build" / "icon.ico", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("Generated unified SalaryFlow flow-mark icons")