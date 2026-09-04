# radiotedu-tui

Spotify-tui inspired interactive RadioTEDU terminal dashboard for Linux, macOS, and Windows.

Inspired by [Rigellute/spotify-tui](https://github.com/Rigellute/spotify-tui), featuring a full multi-pane dashboard layout, real-time dynamic audio spectrum visualizer (`cava` style), Spotify playbar with live progress and interactive volume slider, tabbed navigation, mouse controls, account login (RadioTEDU Account & TEDÜ/ERP SSO), server-verified Gold rewards, and Study timer.

---

## 🚀 Installation & Run

### 1. Windows (Recommended: CMD & PowerShell)

Direct global installation via npm (Zero antivirus false-positives, no execution policy bypass required):
```bash
npm install -g https://radiotedu.com/tui/radiotedu-tui.tgz
```
*(If Node.js is not yet installed on Windows: `winget install OpenJS.NodeJS.LTS`)*

Optional local PowerShell script:
```powershell
irm https://radiotedu.com/install.ps1 -OutFile install.ps1; .\install.ps1
```

### 2. macOS & Linux (curl / bash)
```bash
curl -sSL https://radiotedu.com/install.sh | bash
```

### 3. Direct npm Install (Universal)
```bash
npm install -g https://radiotedu.com/tui/radiotedu-tui.tgz
```

### 4. Launch & Device Pairing
Run from anywhere:
```bash
radiotedu
# or
radiotedu-tui
```

To pair with your RadioTEDU / ERP account and earn Gold rewards (+20 Gold / hour):
```bash
radiotedu login
# or with your 8-digit code from https://radiotedu.com/erp/device
radiotedu login --code=AAAA-BBBB
```

---

## 🎨 Interface Layout & Features

- **Multi-Pane Dashboard**:
  - **Tabs Bar**: `[1: Stations]` · `[2: Visualizer]` · `[3: Study & Lyrics]` · `[4: Account]`
  - **Left Stations Panel**: Live stations with color badges (`Classical`, `Jazz`, `Lo-Fi`, `Energize`, `Rock`, `RadioTEDU`), `[FLAC]` indicators, and selection cursor.
  - **Right Audio Spectrum Panel**: Real-time multi-band animated audio equalizer with labeled frequency axis (`60Hz` to `16kHz`), track title, artist, audio engine, and live buffer status.
  - **Bottom Spotify Playbar**: Now playing metadata, live elapsed playback timer (`04:12 ━━━━━━━━●────── 60:00 [● LIVE]`), visual volume meter (`🔉 [████████░░] 80%`), and clickable action buttons.

---

## 🖱️ Mouse Controls

| Element | Action |
| :--- | :--- |
| **Tab Bar** (`[1: Stations]`, `[2: Visualizer]`, etc.) | **Click** to switch active view |
| **Station Row** | **Click** to immediately play station |
| **Stations List** | **Mouse Wheel** to scroll stations |
| **Playbar (Track name)** | **Click** to toggle Play / Pause |
| **Volume Slider** (`[████████░░]`) | **Click** on slider to set volume directly |
| **Action Buttons** (`[Space]`, `[F]`, `[+]`, `[-]`, `[L]`, `[S]`, `[Q]`) | **Click** to trigger function |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `1` / `2` / `3` / `4` | Switch directly to Tab 1, 2, 3, or 4 |
| `Tab` | Switch active panel focus |
| `↑` / `↓` or `k` / `j` | Navigate stations |
| `Enter` | Play selected station |
| `Space` or `p` | Play / Pause toggle |
| `+` / `-` | Volume Up / Down (±5%) |
| `m` | Mute / Unmute toggle |
| `f` | Toggle Audio Quality (Normal / Low / FLAC) |
| `v` | Quick toggle to full-screen Visualizer tab |
| `l` | Sign In (RadioTEDU Account or TEDÜ ERP SSO) |
| `x` | Sign Out |
| `s` | Toggle / Start Study Session timer |
| `a` | Refresh Account & Gold balance |
| `q` | Quit application cleanly |

---

## 📻 Stations & Formats

- **RadioTEDU**: Flagship station (Normal & Low HE-AAC)
- **Classical**: Classical music with **FLAC Hi-Fi (Lossless 24-bit)**
- **Jazz**: Jazz & Blues with **FLAC Hi-Fi (Lossless 24-bit)**
- **Lo-Fi**: Lo-Fi beats for studying and relaxing
- **Energize**: High-energy workout & focus beats
- **Rock**: Classic & alternative rock
- **English / Français**: Multi-language campus broadcasts
- **Voting**: Live interactive voting channel

Audio playback is powered by `ffplay` or `mpv`.
