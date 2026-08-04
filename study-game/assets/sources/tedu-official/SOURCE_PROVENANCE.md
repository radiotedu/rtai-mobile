# TEDU campus room source provenance

These files are factual transformation sources for the campus world. The production backgrounds may change only projection, scale, crop, and pixel rendering; they must not invent or remove real-world objects.

| Production room | Local source | Official source | Supporting spatial reference | Transformation |
| --- | --- | --- | --- | --- |
| Sports Center | `sports-center.jpg` | [TEDU Life on Campus](https://www.tedu.edu.tr/en/life-campus) (`sporsalonu.jpg`) | [Official TEDU 360 Virtual Tour](https://www.tedu.edu.tr/en/360-virtual-tour) | High overhead modular isometric game-room treatment matching Library and Çim Alan; real equipment categories, layout, colors, ceiling, mirrors, and floor preserved. |
| Fatma–Semih Akbil Auditorium | `fatma-semih-akbil-auditorium.jpg` | [TEDU Life on Campus](https://www.tedu.edu.tr/en/life-campus) (`fatmasemih.jpg`) | [Official TEDU 360 Virtual Tour](https://www.tedu.edu.tr/en/360-virtual-tour) | High overhead modular isometric game-room treatment matching Library and Çim Alan; real seat banks, aisles, stage, wall panels, curtains, and lighting preserved. |

The official tour uses Google-contributed 360 imagery at the TEDU campus coordinates (approximately 39.923052, 32.861636). Google imagery is used only as a visual verification reference. No Google tile, screenshot, attribution, or map asset is redistributed by this package. Any future direct satellite or Street View derivative must be cleared against the current [Google Maps Platform attribution requirements](https://developers.google.com/maps/documentation/tile/policies) before it is committed or shipped.

Generated production files:

- `public/assets/rooms/tedu-sports-center-wide.png`
- `public/assets/rooms/fatma-semih-akbil-auditorium-wide.png`

The portrait `tedu-sports-center.png` and `fatma-semih-akbil-auditorium.png` files remain packaged as transformation inputs. Their production `-wide` derivatives extend only the same walls, floor, seating, aisles, and equipment into a 1672×941 game canvas so PC framing is genuinely 16:9 instead of adding empty side margins.

Each room keeps its factual geometry and object inventory grounded in the corresponding official photograph. The final built-in image editing pass used the existing Library and Çim Alan room art as style references so the Sports Center and Auditorium share the same modular isometric game language, with explicit invariants forbidding new people, architecture, equipment, furniture, props, text, or signage.
