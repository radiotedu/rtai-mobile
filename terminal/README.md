# RadioTEDU Terminal

Spotify-inspired interactive RadioTEDU terminal player for Linux, macOS, and Windows.

Features a full-color terminal user interface (TUI) with mouse control, live station streaming, real-time Icecast Now Playing metadata, audio visualizer, account sign-in (RadioTEDU Account & TEDÜ/ERP SSO), Gold listening rewards, and Study timer.

---

## 🚀 Quick Install

### Linux & macOS (curl)
```bash
curl -fsSL https://raw.githubusercontent.com/radiotedu/rtai-mobile/main/terminal/install.sh | bash
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/radiotedu/rtai-mobile/main/terminal/install.ps1 | iex
```

### npm (Global)
```bash
npm install -g git+https://github.com/radiotedu/rtai-mobile.git#main:terminal
```

---

## 🎧 Usage

Launch the interactive Spotify-style TUI:
```bash
radiotedu
```

### Direct CLI Commands
```bash
# List all available stations and streams
radiotedu stations

# Play a station directly
radiotedu play classic
radiotedu play cazz --quality=flac --allow-metered
radiotedu play radio --player=ffplay

# Account & Gold
radiotedu login           # Interactive sign in (Email & Password or TEDÜ SSO)
radiotedu login --tedu    # Direct TEDÜ / ERP browser SSO flow
radiotedu gold            # View current spendable Gold balance
radiotedu logout          # Sign out

# Study session timer
radiotedu study start library 25
radiotedu study status
radiotedu study stop
```

---

## 🖱️ Controls & Shortcuts

| Action | Keyboard | Mouse |
| :--- | :--- | :--- |
| **Navigate Stations** | `↑` / `↓` or `j` / `k` | **Mouse Wheel Up / Down** |
| **Play Station** | `Enter` | **Left Click** on station row |
| **Pause / Resume** | `Space` or `p` | **Left Click** on Now Playing or `[Space]` |
| **Toggle Quality** | `f` (Normal / Low / FLAC) | **Left Click** on `[F] Quality` |
| **Sign In** | `l` | **Left Click** on `[L] Login` |
| **Sign Out** | `x` | **Left Click** on `[X] Logout` |
| **Refresh Account / Gold** | `a` | **Left Click** on `[A] Refresh` |
| **Study Timer** | `s` | **Left Click** on `[S] Study` |
| **Quit** | `q` | **Left Click** on `[Q] Quit` |

---

## 📻 Stations & Quality

- **RadioTEDU**: Flagship station (Normal & Low HE-AAC)
- **Classical**: Classical music with **FLAC Hi-Fi** support
- **Jazz**: Jazz & Blues with **FLAC Hi-Fi** support
- **Lo-Fi**: Lo-Fi beats for studying and relaxing
- **Energize**: High-energy workout & focus beats
- **Rock**: Classic & alternative rock
- **English / Français**: Multi-language campus broadcasts
- **Voting**: Live interactive voting channel

---

## 🔐 Auth & Gold Architecture

- `login` connects to the authoritative RadioTEDU API (`/auth/login`).
- `login --tedu` initiates the TEDÜ/ERP browser SSO authorization flow.
- Listening rewards use rotating server-issued nonces (`/economy/listening/*`); the server strictly validates all Gold rewards. Tokens are stored securely in platform user config directories.

Requires Node.js 18+ and `mpv` (recommended) or `ffplay` on `PATH`.
