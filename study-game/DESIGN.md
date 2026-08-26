# RadioTEDU Social design direction

## Design read

RadioTEDU Social is an isometric pixel-campus world for TEDU students. It uses RadioTEDU's red, black, cream, and mint interface language with balanced game energy: ENERGY 2 / RHYTHM 2 / MOTION 2.

## Identity

- The campus artwork is the focal point. Interface chrome frames the room without competing with it.
- RadioTEDU red identifies the brand, mint communicates playable or selected states, and warm cream keeps pixel-campus surfaces readable.
- The visual motif is a broadcast control desk translated into compact pixel-game controls.
- Characters use crisp outlined sprites and authored eight-direction poses so they remain readable against detailed rooms.

## Interaction

- A floor click means walk, a chair click means sit, and clicking away while seated means stand and continue walking.
- Furniture, walls, stages, restaurant fixtures, and other solid room geometry are never valid walking targets.
- Motion communicates an action or state transition. Ambient motion stays secondary to navigation and study activity.
- Gold purchases, inventory, study time, moderation, and account state remain server-authoritative.

## Layout

- Desktop keeps the room dominant with compact edge-mounted HUD controls.
- Mobile is a distinct composition with thumb-sized controls, safe-area spacing, and a camera that keeps the avatar and next action legible.
- Panels use solid, high-contrast surfaces. Shadows only separate overlays from the room.

## Typography and accessibility

- Pixel display type is reserved for short game labels. Longer instructions and account text use the existing readable UI face.
- Every interactive control has a high-contrast keyboard focus ring and a touch target of at least 44 by 44 CSS pixels on mobile.
- Empty, loading, error, occupied, blocked, and offline states explain what happened and what the player can do next.

## Decision reasons

- Color: RadioTEDU red establishes ownership; mint is reserved for interaction and verified progress.
- Layout: edge-mounted controls leave the authored campus world as the single visual focal point.
- Typography: limited pixel type preserves game character without reducing long-form readability.
- Spacing: a compact desktop register and a larger mobile touch register match the input method.
- Cards and panels: solid panels are used only for actionable account, social, inventory, event, and moderation content.
- Illustration: every room image and sprite represents a real game location, object, character, or state.
