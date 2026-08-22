#!/usr/bin/env python3
"""Compose a real, sealed ADB screenshot into a 1080x1920 Play image."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, features

WIDTH = 1080
HEIGHT = 1920
LAYOUT_VERSION = "phone-v1"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if draw.textbbox((0, 0), candidate, font=font)[2] <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def centered_text(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
) -> None:
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((WIDTH - (box[2] - box[0])) // 2, y), text, font=font, fill=fill)


def verify_seal(root: Path, manifest_path: Path, session_path: Path) -> None:
    seal_path = root / "raw-manifest.sha256"
    if not seal_path.exists():
        raise SystemExit("Raw evidence is not sealed; run the capture script seal command first.")
    sealed: dict[str, str] = {}
    for line in seal_path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) != 2:
            raise SystemExit("Malformed raw evidence seal.")
        sealed[parts[1]] = parts[0]
    for evidence in (manifest_path, session_path):
        if sealed.get(evidence.name) != digest(evidence):
            raise SystemExit(f"{evidence.name} changed after sealing.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--capture", required=True)
    parser.add_argument("--copy", required=True, type=Path)
    parser.add_argument("--font", required=True, type=Path)
    parser.add_argument(
        "--logo",
        type=Path,
        default=Path("mobile/logos/logo-radiotedu-splash.png"),
    )
    parser.add_argument("--background", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    manifest_path = args.manifest.resolve()
    root = manifest_path.parent
    manifest = read_json(manifest_path)
    if manifest.get("session") != "session.json":
        raise SystemExit("Raw manifest must reference session.json.")
    session_path = root / "session.json"
    verify_seal(root, manifest_path, session_path)
    session = read_json(session_path)
    capture = next(
        (item for item in manifest["captures"] if item["id"] == args.capture),
        None,
    )
    if capture is None:
        raise SystemExit(f"Capture not found: {args.capture}")

    copy_path = args.copy.resolve()
    copy_document = read_json(copy_path)
    copy = copy_document.get(args.capture)
    if not isinstance(copy, dict):
        raise SystemExit(f"Marketing copy missing for capture: {args.capture}")
    for key in ("locale", "eyebrow", "headline", "altText", "proofLabel"):
        if not isinstance(copy.get(key), str) or not copy[key].strip():
            raise SystemExit(f"Copy requires non-empty {key}")
    if copy["locale"] != session["locale"]:
        raise SystemExit("Overlay locale differs from captured app locale.")
    if len(copy["altText"]) > 140:
        raise SystemExit("Alt text must be 140 characters or fewer.")
    if copy["locale"].split("-")[0] == "ar" and not features.check_feature("raqm"):
        raise SystemExit("Arabic output requires Pillow built with RAQM shaping support.")

    font_path = args.font.resolve()
    logo_path = args.logo.resolve()
    background_path = args.background.resolve() if args.background else None
    for required_path in (copy_path, font_path, logo_path, background_path):
        if required_path is None:
            continue
        if not required_path.exists():
            raise SystemExit(f"Required asset missing: {required_path}")

    raw_path = (root / capture["file"]).resolve()
    if not raw_path.is_relative_to(root.resolve()):
        raise SystemExit("Raw capture escapes evidence directory.")
    if digest(raw_path) != capture["sha256"]:
        raise SystemExit("Raw screenshot hash mismatch.")
    raw = Image.open(raw_path)
    if raw.size != (session["width"], session["height"]):
        raise SystemExit("Raw screenshot dimensions differ from the session.")

    inset = capture["insets"]
    crop_box = (
        int(inset["left"]),
        int(inset["top"]),
        raw.width - int(inset["right"]),
        raw.height - int(inset["bottom"]),
    )
    if crop_box[0] >= crop_box[2] or crop_box[1] >= crop_box[3]:
        raise SystemExit("Invalid OS inset crop.")
    screen = raw.convert("RGB").crop(crop_box)

    if background_path:
        canvas = ImageOps.fit(
            Image.open(background_path).convert("RGB"),
            (WIDTH, HEIGHT),
            method=Image.Resampling.LANCZOS,
        )
        shade = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 35))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), shade).convert("RGB")
    else:
        canvas = Image.new("RGB", (WIDTH, HEIGHT), "#08090c")
        draw = ImageDraw.Draw(canvas)
        for y in range(HEIGHT):
            red = max(8, int(28 - 18 * y / HEIGHT))
            draw.line((0, y, WIDTH, y), fill=(red, 7, 10))
        glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse((650, -180, 1280, 450), fill=(227, 30, 36, 75))
        glow_draw.ellipse((-260, 1280, 420, 2050), fill=(183, 139, 48, 38))
        canvas = Image.alpha_composite(
            canvas.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(90))
        ).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    logo = Image.open(logo_path).convert("RGBA")
    logo.thumbnail((520, 100), Image.Resampling.LANCZOS)
    canvas.paste(logo, ((WIDTH - logo.width) // 2, 48), logo)

    eyebrow_font = load_font(font_path, 27)
    headline_font = load_font(font_path, 58)
    proof_font = load_font(font_path, 22)
    centered_text(draw, 160, copy["eyebrow"], eyebrow_font, (221, 175, 76))
    headline_lines = wrap_text(draw, copy["headline"], headline_font, 910)
    if len(headline_lines) > 2:
        raise SystemExit("Headline exceeds the two-line header safe area.")
    for index, line in enumerate(headline_lines):
        centered_text(draw, 204 + index * 65, line, headline_font, (255, 255, 255))

    outer = (108, 372, 972, 1840)
    inner = (132, 404, 948, 1808)
    draw.rounded_rectangle(outer, radius=82, fill=(13, 14, 18), outline=(92, 94, 101), width=5)
    draw.rounded_rectangle(
        (outer[0] + 9, outer[1] + 9, outer[2] - 9, outer[3] - 9),
        radius=74,
        outline=(227, 30, 36),
        width=3,
    )

    target_width = inner[2] - inner[0]
    target_height = inner[3] - inner[1]
    scale = min(target_width / screen.width, target_height / screen.height, 1.0)
    rendered = screen.resize(
        (round(screen.width * scale), round(screen.height * scale)),
        Image.Resampling.LANCZOS,
    )
    screen_layer = Image.new("RGB", (target_width, target_height), "#090a0c")
    screen_layer.paste(
        rendered,
        ((target_width - rendered.width) // 2, (target_height - rendered.height) // 2),
    )
    mask = Image.new("L", (target_width, target_height), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, target_width - 1, target_height - 1), radius=48, fill=255
    )
    canvas.paste(screen_layer, (inner[0], inner[1]), mask)
    centered_text(draw, 1864, copy["proofLabel"], proof_font, (177, 180, 188))

    output = args.output.resolve()
    if not output.is_relative_to(root.resolve()):
        raise SystemExit("Final output must stay inside the evidence directory.")
    if output.exists():
        raise SystemExit(f"Refusing to overwrite final asset: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, format="PNG", optimize=True)
    output_bytes = output.read_bytes()
    if Image.open(output).mode != "RGB" or Image.open(output).size != (WIDTH, HEIGHT):
        raise SystemExit("Final must be 1080x1920 RGB.")
    if output_bytes[25] != 2:
        raise SystemExit("Final PNG must use color type 2 (24-bit RGB, no alpha).")
    if output.stat().st_size > 8 * 1024 * 1024:
        raise SystemExit("Final PNG exceeds 8 MB.")

    final_manifest_path = root / "final-manifest.json"
    final_manifest = (
        read_json(final_manifest_path)
        if final_manifest_path.exists()
        else {"schemaVersion": 1, "layout": LAYOUT_VERSION, "assets": []}
    )
    relative_output = output.relative_to(root).as_posix()
    if any(
        item["captureId"] == args.capture or item["file"] == relative_output
        for item in final_manifest["assets"]
    ):
        output.unlink()
        raise SystemExit("Duplicate final capture id or filename.")
    final_manifest["assets"].append(
        {
            "captureId": args.capture,
            "file": relative_output,
            "sha256": hashlib.sha256(output_bytes).hexdigest(),
            "width": WIDTH,
            "height": HEIGHT,
            "colorType": 2,
            "rawFile": capture["file"],
            "rawSha256": capture["sha256"],
            "cropInsets": inset,
            "scale": scale,
            "gitSha": session["gitSha"],
            "sessionSha256": digest(session_path),
            "apkSha256": session["apk"]["sha256"],
            "locale": copy["locale"],
            "altText": copy["altText"],
            "fontSha256": digest(font_path),
            "logoSha256": digest(logo_path),
            "backgroundSha256": digest(background_path) if background_path else None,
            "copySha256": digest(copy_path),
            "layout": LAYOUT_VERSION,
        }
    )
    final_manifest_path.write_text(
        json.dumps(final_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Composed verified portrait asset: {output}")


if __name__ == "__main__":
    main()
