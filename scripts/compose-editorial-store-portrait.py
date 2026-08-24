#!/usr/bin/env python3
"""Compose a restrained editorial Play Store portrait from a real app capture."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1080
HEIGHT = 1920
BACKGROUND = "#310006"
SCREEN_LEFT = 84
SCREEN_TOP = 430
SCREEN_WIDTH = WIDTH - (SCREEN_LEFT * 2)
CORNER_RADIUS = 52


def fit_font(draw: ImageDraw.ImageDraw, font_path: Path, lines: list[str]) -> ImageFont.FreeTypeFont:
    for size in range(70, 43, -2):
        font = ImageFont.truetype(str(font_path), size=size)
        if max(draw.textbbox((0, 0), line, font=font)[2] for line in lines) <= 890:
            return font
    raise SystemExit("Headline is too wide.")


def rounded_top_mask(size: tuple[int, int], radius: int) -> Image.Image:
    width, height = size
    mask = Image.new("L", size, 255)
    draw = ImageDraw.Draw(mask)
    draw.rectangle((0, 0, width, radius), fill=0)
    draw.rounded_rectangle((0, 0, width - 1, radius * 2), radius=radius, fill=255)
    return mask


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--headline", required=True)
    parser.add_argument("--font", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    for path in (args.input, args.font):
        if not path.exists():
            raise SystemExit(f"Missing input: {path}")
    if args.output.exists():
        raise SystemExit(f"Refusing to overwrite: {args.output}")

    lines = [line.strip().upper() for line in args.headline.split("|") if line.strip()]
    if not 1 <= len(lines) <= 2:
        raise SystemExit("Headline must contain one or two lines separated by |.")

    canvas = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    font = fit_font(draw, args.font, lines)
    line_height = 78
    text_top = 110 if len(lines) == 2 else 154
    for index, line in enumerate(lines):
        box = draw.textbbox((0, 0), line, font=font)
        x = (WIDTH - (box[2] - box[0])) // 2
        draw.text((x, text_top + index * line_height), line, font=font, fill="white")

    source = Image.open(args.input).convert("RGB")
    rendered_height = round(source.height * SCREEN_WIDTH / source.width)
    screen = source.resize((SCREEN_WIDTH, rendered_height), Image.Resampling.LANCZOS)
    mask = rounded_top_mask(screen.size, CORNER_RADIUS)

    shadow = Image.new("RGBA", screen.size, (0, 0, 0, 0))
    shadow.putalpha(mask)
    shadow_fill = Image.new("RGBA", screen.size, (0, 0, 0, 175))
    shadow_fill.putalpha(mask)
    blurred = shadow_fill.filter(ImageFilter.GaussianBlur(18))
    canvas.paste(blurred, (SCREEN_LEFT, SCREEN_TOP + 18), blurred)
    canvas.paste(screen, (SCREEN_LEFT, SCREEN_TOP), mask)

    # One quiet brand-colour hairline, matching the restrained reference style.
    draw.rounded_rectangle(
        (SCREEN_LEFT, SCREEN_TOP, SCREEN_LEFT + SCREEN_WIDTH - 1, SCREEN_TOP + rendered_height),
        radius=CORNER_RADIUS,
        outline="#8D1018",
        width=3,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, format="PNG", optimize=True)
    result = Image.open(args.output)
    if result.size != (WIDTH, HEIGHT) or result.mode != "RGB":
        raise SystemExit("Output must be 1080x1920 RGB.")
    print(args.output)


if __name__ == "__main__":
    main()
