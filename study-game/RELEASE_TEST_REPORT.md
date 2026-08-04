# RadioTEDU Study release test report

Date: 2026-08-04

## Release gates

| Gate | Result |
| --- | --- |
| Contract and unit suite | Passed — 31 files, 145 unit tests; contract runner passed |
| Production TypeScript/Vite build | Passed |
| Desktop/mobile Playwright suite | Passed — 27 tests, 1 intentional platform skip |
| Exhaustive wardrobe matrix | Passed on desktop and mobile |
| Authoritative Gold purchase journey | Passed on desktop and mobile |
| Campus navigator, study path, chat reactions, ignore/report journey | Passed on desktop and mobile |
| 60-player concurrent stress run | Passed |
| Secret scan | Passed — no findings |

## Wardrobe coverage

The browser matrix equips and verifies every shipped wardrobe choice:

- Tops: Radio Hoodie, Varsity Jacket
- Bottoms: Jeans, Black Cargos
- Shoes: Sneakers, Boots
- Hats: Bucket Hat, Beanie

It verifies live layered textures, preview textures, room persistence, walking, sitting, standing, and the final premium outfit on desktop and mobile. The lower-level asset contract also verifies all actions and directions for every wearable sheet.

## Gold coverage

- The local adapter cannot mint or spend Gold.
- Hosted purchases use the authenticated server adapter.
- Rapid duplicate purchase clicks share one in-flight operation.
- A purchase is accepted only when the response proves ownership of the requested item and returns a non-negative integer authoritative balance.
- Equipping a replacement removes the prior item in that slot.
- The browser journey verifies balance transitions `240 → 160 → 100 → 50 → 15` while buying all four paid items.
- Event registration does not mint Gold locally; verified rewards remain server-owned.

## 60-player result

The final local shared-backend simulation ran 60 simultaneous real-time protocol clients without launching a headless browser:

- 60/60 clients joined
- 59 peers visible from every client
- room occupancy `60/90`
- 180 requested walking operations, 0 failures
- 180 accepted movement updates; all 60 players moved and remained fresh
- 60 simultaneous room-scoped chat messages accepted
- 482 API requests, 0 request errors, 0 server errors
- 60 maximum concurrent requests
- response latency: 76.9 ms median, 172.2 ms p95

Visual rendering and interaction are covered separately by the passing desktop/mobile evidence suite. The no-headless stress harness verifies real-time join, room occupancy, presence fan-out, walking heartbeats, freshness, chat, concurrency, and error behavior. The deployed RadioTEDU API must still be load-tested with real staging accounts.

## Known non-blocking build warnings

- The local machine runs Node.js 20.18.1; Vite recommends Node.js 20.19+ or 22.12+.
- The Phaser production chunk exceeds Vite's default 500 kB advisory threshold.

The server handoff requires Node.js 20.19 or newer.
