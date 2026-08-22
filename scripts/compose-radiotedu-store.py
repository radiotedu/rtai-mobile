from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "store-screenshots"
BG = OUT / "radiotedu-store-background.png"
FONT = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
LOGO = ROOT / "mobile" / "logos" / "logo-radiotedu-splash.png"

W, H = 1920, 1080
WHITE = (246, 246, 248, 255)
MUTED = (184, 182, 190, 255)
RED = (239, 29, 39, 255)
GOLD = (255, 203, 42, 255)
PANEL = (12, 12, 16, 190)


def font(size, bold=False):
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT), size)


def cover_background():
    im = Image.open(BG).convert("RGBA")
    scale = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
    left = (im.width - W) // 2
    top = (im.height - H) // 2
    return im.crop((left, top, left + W, top + H))


def crop_system_bars(im):
    """Remove Android status/navigation bars, retain real app pixels."""
    im = im.convert("RGBA")
    if im.height >= 1500:
        top, bottom = 80, 185
    else:
        top, bottom = 24, 88
    return im.crop((0, top, im.width, max(top + 1, im.height - bottom)))


def rounded(im, radius=42):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def phone(src, height=790):
    screen = crop_system_bars(Image.open(src))
    width = round(screen.width * height / screen.height)
    screen = rounded(screen.resize((width, height), Image.Resampling.LANCZOS), 36)
    pad = 18
    body = Image.new("RGBA", (width + pad * 2, height + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", body.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((3, 7, body.width - 4, body.height - 1), 52, fill=(0, 0, 0, 230))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    body.alpha_composite(shadow)
    d = ImageDraw.Draw(body)
    d.rounded_rectangle((0, 0, body.width - 1, body.height - 1), 52, fill=(6, 6, 8, 255), outline=(96, 96, 104, 255), width=2)
    body.alpha_composite(screen, (pad, pad))
    # Neutral handset overlay; no system status/navigation bars are retained.
    d = ImageDraw.Draw(body)
    d.rounded_rectangle((body.width // 2 - 48, 7, body.width // 2 + 48, 18), 8, fill=(5, 5, 7, 255))
    d.rounded_rectangle((body.width // 2 - 34, body.height - 12, body.width // 2 + 34, body.height - 7), 4, fill=(210, 210, 216, 220))
    return body


def text(draw, xy, value, size, fill=WHITE, bold=False, anchor=None):
    draw.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


def logo(canvas, x=92, y=74, width=310):
    im = Image.open(LOGO).convert("RGBA")
    im.thumbnail((width, 70), Image.Resampling.LANCZOS)
    canvas.alpha_composite(im, (x, y))


def base(title, subtitle, eyebrow):
    canvas = cover_background()
    # readable content panel while keeping generated texture visible
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rounded_rectangle((52, 44, W - 52, H - 44), 40, fill=PANEL, outline=(110, 74, 36, 150), width=2)
    canvas.alpha_composite(overlay)
    d = ImageDraw.Draw(canvas)
    logo(canvas)
    text(d, (92, 218), eyebrow.upper(), 24, GOLD, True)
    text(d, (92, 265), title, 72, WHITE, True)
    text(d, (96, 360), subtitle, 30, MUTED)
    text(d, (96, H - 86), "RadioTEDU Android  •  Real app captures  •  English", 19, (150, 148, 158, 255))
    return canvas


def badge(draw, x, y, label, color=RED):
    draw.rounded_rectangle((x, y, x + 185, y + 44), 22, fill=(40, 16, 20, 230), outline=color, width=2)
    text(draw, (x + 92, y + 22), label, 19, color, True, "mm")


def make_games():
    canvas = base("Play. Listen. Earn.", "Real games, real scores, and RadioTEDU Gold in one app.", "Games")
    d = ImageDraw.Draw(canvas)
    p1 = phone(OUT / "57-games-english-top-1080x1920.png", 760)
    p2 = phone(OUT / "56-games-english-real-1080x1920.png", 680)
    canvas.alpha_composite(p1, (1070, 198))
    canvas.alpha_composite(p2, (1545, 262))
    badge(d, 96, 465, "SNAKE  •  MEMORY")
    badge(d, 96, 525, "BLOCKS  •  RHYTHM", GOLD)
    badge(d, 96, 585, "WORD GUESS", (135, 180, 255, 255))
    text(d, (98, 700), "Browse in English.\nPlay for real.", 42, WHITE, True)
    text(d, (98, 820), "Guest browsing stays open;\nan account unlocks scores and rewards.", 24, MUTED)
    return canvas


def make_radio():
    canvas = base("Live radio, your way.", "Station artwork, live metadata, and quality controls that fit your connection.", "Radio")
    d = ImageDraw.Draw(canvas)
    p1 = phone(OUT / "59-radio-1080x1920.png", 760)
    p2 = phone(OUT / "35-flac-selected-menu.png", 635)
    canvas.alpha_composite(p1, (1075, 198))
    canvas.alpha_composite(p2, (1535, 310))
    badge(d, 96, 480, "LIVE METADATA")
    badge(d, 96, 540, "LOW  •  NORMAL", (190, 190, 198, 255))
    badge(d, 96, 600, "FLAC  •  CLASSIC / CAZZ", GOLD)
    text(d, (98, 720), "RadioTEDU\nfrom first play to FLAC.", 40, WHITE, True)
    text(d, (98, 837), "Quality lives in Now Playing.\nStation names stay clear and honest.", 24, MUTED)
    return canvas


def make_gold():
    canvas = base("One app. Many ways to listen.", "Radio, games, Jukebox, Study, and Gold—organized in one RadioTEDU experience.", "RadioTEDU")
    d = ImageDraw.Draw(canvas)
    p1 = phone(OUT / "55-games-english-1080x1920.png", 760)
    p2 = phone(OUT / "57-games-english-top-1080x1920.png", 660)
    canvas.alpha_composite(p1, (1075, 198))
    canvas.alpha_composite(p2, (1540, 285))
    badge(d, 96, 470, "RADIO")
    badge(d, 96, 530, "GAMES", GOLD)
    badge(d, 96, 590, "GOLD", RED)
    text(d, (98, 715), "A focused home\nfor every listener.", 42, WHITE, True)
    text(d, (98, 836), "Fully English presentation.\nAccount-gated rewards are labeled in-app.", 24, MUTED)
    return canvas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    outputs = {
        "radiotedu-store-games.png": make_games(),
        "radiotedu-store-radio.png": make_radio(),
        "radiotedu-store-home.png": make_gold(),
    }
    for name, image in outputs.items():
        image.convert("RGB").save(OUT / name, quality=95)
        print(OUT / name)


if __name__ == "__main__":
    main()
