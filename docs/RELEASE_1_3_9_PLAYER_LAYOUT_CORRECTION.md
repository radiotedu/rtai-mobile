# Player layout correction after visual review

September 13, 2026. The user identified two unacceptable e32 candidate layouts: a portrait lyrics card with its bottom edge hidden, and landscape artwork with song/artist metadata outside the viewport. Earlier transport checks were too narrow to certify the complete player.

Source changes:

- Portrait: keep the complete lyrics card outside the artwork/metadata scroll area, directly above transport controls; reserve more space for it by reducing artwork size while lyrics are open. Lyrics scroll inside their own card.
- Landscape: display artwork alongside a details column containing the song, artist and lyrics. The station remains visible in the header. Smaller transport controls retain 56dp play and 56dp side-button targets while freeing vertical space.
- Remove the redundant `RadioTEDU · RadioTEDU` header prefix.
- Extend device checks to require nonempty station/song/artist nodes in the visible area above controls. If lyrics are present, require a card tall enough for its header and a text line, entirely above controls and outside any scrolling ancestor. Absence of lyrics is explicitly recorded and cannot establish a lyrics-layout pass.

Local source validation: 409 tests in 103 suites passed; TypeScript passed; lint completed with 0 errors and 227 retained warnings; v1.3.9 release-version validation and 36/36 Android source checks passed. No native build ran locally. Production-signed build and actual phone/tablet/orientation screenshots must verify this correction before it is described as fixed on-device.

Do not treat the current e32 APK or its passing transport-only tests as proof of these new visual corrections. Full Android Auto projection, isolated account/Gold flows and remaining release gates are unchanged.
