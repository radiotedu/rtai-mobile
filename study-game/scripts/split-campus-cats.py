from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art" / "npcs" / "campus-cats.png"
OUTPUT_DIR = ROOT / "public" / "assets" / "npcs"
OUTPUTS = ("campus-cat-tarcin.png", "campus-cat-benek.png", "campus-cat-komur.png")


with Image.open(SOURCE) as atlas:
    width, height = atlas.size
    edges = [round(index * width / 3) for index in range(4)]
    for index, filename in enumerate(OUTPUTS):
        frame = atlas.crop((edges[index], 0, edges[index + 1], height))
        frame.thumbnail((256, 288), Image.Resampling.LANCZOS)
        frame.save(OUTPUT_DIR / filename, optimize=True)

print(f"Wrote {len(OUTPUTS)} campus cat textures from {SOURCE.name}")
