# RadioTEDU terminal

Spotify-inspired RadioTEDU terminal player for Linux, macOS, and Windows. The interactive TUI includes live stations, Now Playing metadata, quality selection, login/logout, Gold balance and verified listening rewards. JukeLocal is intentionally excluded.

## Run

Requires Node.js 18+ and `mpv` (recommended) or `ffplay` on `PATH`.

```text
npm install -g radiotedu
radiotedu
radiotedu stations
radiotedu play radio --player=ffplay

# Repository development
npm start
npm start -- stations
npm start -- play cazz --quality=flac --allow-metered
npm start -- play radio --player=ffplay
npm start -- login
npm start -- gold
npm start -- study start library 25
```

Controls: arrow keys or `j`/`k`, Enter/click to play, mouse wheel to move, `f` quality, Space/`p` pause-resume, `l` login, `x` logout, `a` refresh account/Gold, `s` Study timer and `q` quit.

Normal and low mounts use HE-AAC v1. FLAC is offered only for `/classic-flac` and `/cazz-flac`. Icecast `StreamTitle` metadata appears in the player.

`login` uses the same RadioTEDU API as the mobile app (`/auth/login`). `login --tedu` starts the ERP/TEDÜ browser flow and exchanges the returned code. Signed-in listening uses the existing rotating-nonce `/economy/listening/*` protocol; the server remains authoritative for Gold awards. Tokens are stored in the platform configuration directory with restrictive file permissions.

Study sessions use the existing `/study/sessions/*` API, send heartbeats, and display elapsed minutes. `radiotedu study status` reports the active local timer; `study stop` finishes it server-side.

Set `RADIOTEDU_API_BASE`, `RADIOTEDU_STREAM_ORIGIN`, or `RADIOTEDU_PLAYER` to point at a test service/player.
