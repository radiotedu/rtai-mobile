# Store image candidates — 1.3.9

Three 1080 × 1920 HTML-rendered previews using actual app captures from signed source `3d8770486040f08c9257bb2b33250e4db5060403`. These are listing candidates, not evidence of store approval or completion of the release gates.

| Preview | Original capture | Provenance |
| --- | --- | --- |
| [Radio](radio.png) | `raw/home.png` | Phone run 34745830092, `05-home.png` |
| [Podcasts](podcasts.png) | `raw/podcasts-loaded.png` | Local emulator with the same APK; loaded BPW episodes verified in UI tree and screenshot |
| [Share](share.png) | `raw/share-story.png` | Phone run 34745830092, native Story export |

Phone images retain their original aspect ratio through width-only scaling. The share image is an exported card, not a phone mockup. Manrope comes from the existing `../../release-1.3.7/fonts/` assets and their OFL license. Artwork remains part of the captured app content; no competitor artwork or layouts were copied.

Open `poster.html?card=radio`, `?card=podcasts`, or `?card=share`. Render at 1080 × 1920, device scale factor 1, after local fonts and images load. All three rendered images were visually reviewed; headlines, device proportions and footers fit. PNGs were decoded and hashed in `manifest.json`.

The original cloud podcast screenshot caught a launcher transition despite its UI tree containing episode nodes. It was rejected for this listing. A subsequent local loading screenshot was also rejected. Both remain in local output backups; only the fully loaded capture is included here.

Tablet, website and Android Auto-specific listing material and final Play Console declarations remain outstanding. These assets do not establish WhatsApp/Instagram receipt or Android Auto projection support.
