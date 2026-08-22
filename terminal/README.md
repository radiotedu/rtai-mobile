# RadioTEDU terminal

Terminal-first RadioTEDU player for Linux, macOS, and Windows. It supports an interactive keyboard/mouse TUI and scriptable commands. JukeLocal is intentionally excluded.

## Run

Requires Node.js 18+ and `mpv` (recommended) or `ffplay` on `PATH`.

```text
npm start
npm start -- stations
npm start -- play cazz --quality=flac --allow-metered
npm start -- login
npm start -- study start library 25
```

Controls: arrow keys or `j`/`k`, Enter/click to play, mouse wheel to move, `f` quality, `p` pause, `s` Study timer, `a` account, `q` quit. SGR mouse tracking is enabled when the terminal supports it; normal keyboard use remains available elsewhere.

Normal and low mounts use HE-AAC v1. FLAC is offered only for `/classic-flac` and `/cazz-flac`. Icecast `StreamTitle` metadata appears in the player.

`login` uses the same RadioTEDU API as the mobile app (`/auth/login`). `login --tedu` starts the ERP/TEDÜ browser flow and exchanges the returned code. Tokens are stored in the platform configuration directory with restrictive file permissions; production packaging should add native Credential Manager/Keychain/Secret Service adapters.

Study sessions use the existing `/study/sessions/*` API, send heartbeats, and display elapsed minutes. `radiotedu study status` reports the active local timer; `study stop` finishes it server-side.

Set `RADIOTEDU_API_BASE`, `RADIOTEDU_STREAM_ORIGIN`, or `RADIOTEDU_PLAYER` to point at a test service/player.
