<div align="center">

# 📻 radiotedu-tui

**The Spotify-TUI inspired terminal client, 32-band real-time audio spectrum visualizer, Focus Pomodoro lounge, server-verified Gold listening engine, and campus Study companion for RadioTEDU.**

[![Version](https://img.shields.io/badge/version-v1.4.3-brightgreen.svg?style=flat-square)](package.json)
[![Author](https://img.shields.io/badge/author-akgularda-blue.svg?style=flat-square&logo=github)](https://github.com/akgularda)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-informational.svg?style=flat-square&logo=node.js)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey.svg?style=flat-square)](https://github.com/radiotedu/radiotedu-tui)
[![Audio Engines](https://img.shields.io/badge/audio-mpv%20%7C%20ffplay%20(auto--fetch)-orange.svg?style=flat-square)](https://mpv.io)
[![Dependencies](https://img.shields.io/badge/dependencies-0%20(Pure%20Node.js)-success.svg?style=flat-square)](package.json)
[![License](https://img.shields.io/badge/license-RadioTEDU-red.svg?style=flat-square)](https://radiotedu.com)

[🚀 Quick Start](#-installation--quick-start) •
[🎨 Interface Layout](#-interface-layout) •
[⌨️ Controls](#-keyboard-shortcuts--controls) •
[🖱️ Mouse Support](#-mouse-controls) •
[📻 Stations & FLAC](#-stations--stream-qualities) •
[🔐 Authentication & SSO](#-authentication--erp-sso) •
[⚡ CLI Mode](#-headless-cli-commands) •
[👤 Author](#-author--maintainer)

</div>

---

## 🌟 Overview

`radiotedu-tui` brings the sleek aesthetic of [Rigellute/spotify-tui](https://github.com/Rigellute/spotify-tui) and the modern OpenCode / Catppuccin palette to your terminal. Stream campus live broadcasts, enjoy **Lossless 24-bit FLAC** audio on Classical and Jazz channels, watch a real-time animated graphic equalizer, track Study & Focus Pomodoro sessions in TED University campus areas, and earn server-verified RadioTEDU Gold rewards—all with **zero external npm runtime dependencies**.

### Key Highlights

- 🎛️ **Multi-Pane TUI Dashboard**: Tabbed interface (`[1: Stations]`, `[2: Visualizer]`, `[3: Study & Lyrics]`, `[4: Account]`) with smooth layout adaptation for any terminal size (min 96 columns).
- 📊 **32-Band Audio Spectrum Visualizer**: Dynamic multi-octave harmonic audio equalizer (`cava` style) with sub-bass, mid, and treble simulation, peak-hold decay dots, and labeled frequency axis (`60Hz` to `16kHz`).
- 🎵 **Pristine Audio Streaming**: Support for **FLAC 24-bit Hi-Fi**, HE-AAC v2, AAC-LC, MP3, and Ogg/Opus streams.
- 🔊 **Zero-Config Audio Auto-Download**: Automatically detects `mpv` or `ffplay`. If neither is found, `radiotedu-tui` automatically downloads a lightweight, audio-only `ffplay` binary on first launch (Windows & Linux).
- 🖱️ **Full Mouse & Keyboard Integration**: Native 1006 SGR mouse support (click to play stations, switch tabs, drag/click volume slider, trigger control action pills) alongside intuitive keyboard shortcuts.
- 🔐 **Secure Dual Authentication**:
  - Direct **RadioTEDU Account** login via an interactive terminal modal with masked password input.
  - **TED University ERP SSO** with an instant 8-character device pairing code (`AAAA-BBBB` at `radiotedu.com/erp/device`) and RFC 7636 PKCE S256 challenge security.
- 🪙 **Server-Verified Gold Listening**: Listening proof engine with rotating cryptographic nonces and heartbeat verification—no client-side minting or tampering (+20 Gold / hour).
- 📚 **Focus Pomodoro & Study Companion**: Built-in 25/5 and 50/10 Focus Pomodoro timer and Study tracker for TEDU Library and Çim Alan, linked directly with user account stats.
- ⚡ **Ultra-Lightweight & Cross-Platform**: Runs natively on Linux, macOS, and Windows with 0 npm bloat using standard Node.js 18+ runtime APIs.

---

## 🎨 Interface Layout

```text
╭─ 📻 RADIOTEDU // LIVE DASHBOARD v1.4.3 ────────────────────────────────────────── [👤 akgularda  ◆ 420 Gold] ─╮
│  [1: Stations]   2: Visualizer   3: Study & Lyrics   4: Account                                               │
├───────────────────────────────────┬───────────────────────────────────────────────────────────────────────────┤
│ STATIONS (9 CHANNELS)             │ LIVE AUDIO SPECTRUM & STREAM INFO                                         │
│                                   │                                                                           │
│   ● RadioTEDU     Flagship Main   │       •               •               •                                   │
│   ● Classical     Symphonic [FLAC]│     █ █ █           █ █ █           █ █ █           █ █                   │
│ ▸ ● Jazz          Bebop     [FLAC]│     █ █ █ █       █ █ █ █ █       █ █ █ █ █       █ █ █ █                 │
│   ● Lo-Fi         Chillhop Beats  │   █ █ █ █ █ █   █ █ █ █ █ █ █   █ █ █ █ █ █ █   █ █ █ █ █ █               │
│   ● Energize      Workout EDM     │   █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █           │
│   ● Rock          Classic & Alt   │   60Hz 125Hz 250Hz  500Hz  1kHz   2kHz   4kHz   8kHz  16kHz               │
│   ● English       Campus English  │                                                                           │
│   ● Français      Campus French   │   Station : Jazz (FLAC) · 24-bit 96kHz Lossless                           │
│   ● Voting        Audience Vote   │   Track   : Miles Davis - So What                                         │
│                                   │   Engine  : mpv · Buffer Healthy · Normal Latency                         │
├───────────────────────────────────┴───────────────────────────────────────────────────────────────────────────┤
│ NOW PLAYING: Miles Davis - So What                                                                            │
│ 04:12 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●────────────────────────────────────────────── 60:00 [● LIVE]        │
│                                                                                                               │
│   [Space] Pause   [F] FLAC   [+] Vol+   [-] Vol-   [L] Login   [S] Study   [Q] Quit     🔉 [████████░░] 80%    │
╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

---

## 🚀 Installation & Quick Start

### Prerequisites

1. **Node.js**: Version 18.0.0 or higher.
2. **Audio Player Engine**: Supported engines are `mpv` (recommended) or `ffplay`. *(If neither is installed, `radiotedu-tui` automatically downloads a lightweight `ffplay` audio binary for you on Windows & Linux).*

---

### Option 1: Windows Installation (CMD & PowerShell)

Direct global installation via npm (Zero antivirus false-positives, no execution policy bypass required):

```bash
npm install -g https://radiotedu.com/tui/radiotedu-tui.tgz
```
*(If Node.js is not yet installed: `winget install OpenJS.NodeJS.LTS`)*

Alternatively, using PowerShell:

```powershell
irm https://radiotedu.com/install.ps1 -OutFile install.ps1; .\install.ps1
```

---

### Option 2: Linux & macOS Installation

Use the automated curl installer script:

```bash
curl -sSL https://radiotedu.com/install.sh | bash
# or from GitHub:
curl -fsSL https://raw.githubusercontent.com/radiotedu/radiotedu-tui/main/install.sh | bash
```

---

### Option 3: Universal npm / Git Install

Install globally from the official Git repository:

```bash
npm install -g git+https://github.com/radiotedu/radiotedu-tui.git
```

---

### Option 4: Run Directly from Source

```bash
git clone https://github.com/radiotedu/radiotedu-tui.git
cd radiotedu-tui
node src/index.js
```

---

### Launching the Player

Run from anywhere in your shell:

```bash
radiotedu
# or
radiotedu-tui
```

To pair with your RadioTEDU or TEDÜ ERP account to unlock Gold rewards (+20 Gold / hour):

```bash
radiotedu login
# or directly with your 8-digit code from https://radiotedu.com/erp/device
radiotedu login --code=AAAA-BBBB
```

---

## ⌨️ Keyboard Shortcuts & Controls

### Navigation & Views

| Shortcut | Action |
| :--- | :--- |
| `1` | Switch to **Tab 1: Stations & Spectrum** |
| `2` | Switch to **Tab 2: Fullscreen Audio Visualizer** |
| `3` | Switch to **Tab 3: Campus Study Timer & Lyrics** |
| `4` | Switch to **Tab 4: Account & Gold Balance** |
| `Tab` | Cycle active focus between interface panels |
| `v` | Quick-toggle fullscreen visualizer mode |

### Playback & Audio

| Shortcut | Action |
| :--- | :--- |
| `↑` / `↓` &nbsp;or&nbsp; `k` / `j` | Navigate station list cursor |
| `Enter` | Play selected station immediately |
| `Space` &nbsp;or&nbsp; `p` | Toggle Play / Pause |
| `+` / `-` &nbsp;or&nbsp; `=` / `_` | Increase / Decrease volume (±5%) |
| `m` | Mute / Unmute audio |
| `f` | Toggle Audio Stream Quality (`Normal` ↔ `Low` ↔ `FLAC`) |

### Account & Session Management

| Shortcut | Action |
| :--- | :--- |
| `l` | Open Sign In Modal Dialog (RadioTEDU Account or TEDÜ ERP SSO) |
| `x` | Sign Out cleanly |
| `a` | Force-refresh account data & spendable Gold points |
| `s` | Start / Stop Focus & Study Session |
| `q` &nbsp;or&nbsp; `Ctrl+C` | Stop audio and exit application cleanly |

---

## 🖱️ Mouse Controls

`radiotedu-tui` comes with first-class SGR mouse tracking:

- **Switch Tabs**: Click on `[1: Stations]`, `[2: Visualizer]`, `[3: Study & Lyrics]`, or `[4: Account]` to change tabs instantly.
- **Select & Play**: Click directly on any station row to tune in immediately.
- **Scroll Stations**: Use the mouse scroll wheel over the station panel to scroll smoothly.
- **Toggle Playback**: Click on the track metadata or playbar to toggle between Play and Pause.
- **Interactive Volume Slider**: Click anywhere along the volume meter bar `[████████░░]` to jump straight to that volume level.
- **Action Buttons**: Click on any bottom button pill (`[Space]`, `[F]`, `[+]`, `[-]`, `[L]`, `[S]`, `[Q]`) to trigger its action.

---

## 📻 Stations & Stream Qualities

RadioTEDU broadcasts across 9 official mounts, supporting multi-quality fallback and lossless audiophile delivery:

| Station | Genre / Purpose | Qualities Supported | Default Codec | Lossless FLAC |
| :--- | :--- | :--- | :--- | :---: |
| **RadioTEDU** | Flagship Campus Channel | `Normal`, `Low` | HE-AAC v2 | — |
| **Classical** | Symphonic, Concerto & Chamber | `Normal`, `Low`, `FLAC` | FLAC 24-bit | ✅ **24-bit Hi-Fi** |
| **Jazz** | Bebop, Soul, Swing & Modern Jazz | `Normal`, `Low`, `FLAC` | FLAC 24-bit | ✅ **24-bit Hi-Fi** |
| **Lo-Fi** | Chillhop Beats for studying | `Normal`, `Low` | HE-AAC v2 | — |
| **Energize** | High-tempo workout & EDM | `Normal`, `Low` | HE-AAC v2 | — |
| **Rock** | Classic Rock & Alternative | `Normal`, `Low` | HE-AAC v2 | — |
| **English** | International Campus Broadcast | `Normal` | MP3 192k | — |
| **Français** | French Language Broadcast | `Normal` | MP3 192k | — |
| **Voting** | Interactive live listener-voted stream | `Normal` | Ogg/Opus | — |

> 💡 **Tip**: Press `f` or click `[F]` to cycle through available stream qualities. When tuning to `FLAC` on metered connections, confirmation is requested to prevent unintended data usage.

---

## 🔐 Authentication & Single Sign-On

`radiotedu-tui` provides a unified sign-in flow supporting GitHub CLI style automated device pairing, direct email/password login, and TEDÜ ERP SSO:

```text
╭─ 🔐 RADIOTEDU SIGN IN // HESAP GİRİŞİ ────────────────────────╮
│  Lütfen oturum açma yöntemini seçin:                         │
│                                                              │
│  [1] 🌐 Web ile Oturum Aç (Otomatik Onay / GitHub CLI Stili) │
│  [2] 📧 RadioTEDU Hesabı (E-Posta & Şifre)                   │
│  [3] 🏛️ TEDÜ / ERP Girişi (8 Haneli Kod: AAAA-BBBB)          │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│  Klavyeden [1], [2] veya [3]'e basın  ·  [Esc] İptal         │
╰──────────────────────────────────────────────────────────────╯
```

### 1. Web ile Oturum Aç (GitHub CLI Stili — Önerilen)
Klavyeden `1` tuşuna basın. Terminal otomatik olarak benzersiz bir cihaz kodu üretir ve tarayıcınızda `https://radiotedu.com/device?code=ABCD-EFGH` adresini açar:
1. Tarayıcınızda aktif RadioTEDU veya TEDÜ ERP oturumunuz varsa tek tıkla **"Cihazı Onayla"** diyerek yetki verebilirsiniz.
2. Hesabınız yoksa aynı sayfa üzerinden saniyeler içinde yeni dinleyici hesabı oluşturabilirsiniz.
3. Onay verdiğiniz anda terminal otomatik olarak oturumu algılar, JWT token'larını kaydeder ve Gold bakiyenizi yükler.

### 2. RadioTEDU Hesabı (E-Posta & Şifre)
Klavyeden `2` tuşuna basın. E-posta ve şifrenizi doğrudan terminal penceresinde girin. Şifreniz maskelenerek korunur.

### 3. TEDÜ / ERP Eşleştirme Kodu (8 Haneli Kod)
Klavyeden `3` tuşuna basın. Tarayıcınızda `https://radiotedu.com/erp/device` sayfası açılır, ekrandaki 8 haneli kodu terminale girerek eşleştirebilirsiniz.

### Security Architecture

- **RFC 7636 PKCE (S256)**: Proof Key for Code Exchange with SHA-256 code challenge prevents authorization code interception attacks.
- **Ephemeral Token Storage**: Credentials and tokens are saved locally in the user profile store with strict file permission masks.
- **Heartbeat & Nonce Verification**: Gold points and study rewards are verified on the RadioTEDU backend with rotating nonces to ensure fair play.

---

## ⚡ Headless CLI Commands

In addition to the interactive TUI, `radiotedu` can be used as a scriptable command-line tool:

```bash
# List all stations and supported stream qualities
radiotedu stations

# Output station directory in JSON format
radiotedu stations --json

# Play Classical in 24-bit Lossless FLAC using mpv
radiotedu play classic --quality=flac --player=mpv

# Play Lo-Fi in low-bandwidth mode
radiotedu play lofi --quality=low

# Sign in to RadioTEDU or TEDÜ ERP via CLI prompt
radiotedu login
radiotedu login --tedu
radiotedu login --code=AAAA-BBBB

# Check current user profile & spendable Gold points
radiotedu account
radiotedu gold

# Start a 45-minute study session at TEDU Library
radiotedu study start library 45

# Check active study session status
radiotedu study status

# Stop active study session and record earned points
radiotedu study stop

# Sign out
radiotedu logout

# Display help or version
radiotedu help
radiotedu --version
```

---

## 🧪 Testing & Code Quality

The terminal client includes built-in test suites covering RFC vectors, audio player binary resolution, station mount contracts, and input parsing:

```bash
# Run automated Node.js test runner suites
npm test

# Run syntax check across all JavaScript source modules
npm run check
```

### Test Suite Coverage

- `✔ login, Gold balance and verified listening use existing production contracts`
- `✔ quality mounts match RadioTEDU contract`
- `✔ Voting stays last and uses its single live mount`
- `✔ ffplay is detected and launched as an audio-only player`
- `✔ Gold balance only accepts a non-negative server integer`
- `✔ station aliases keep cazz as the public mount`
- `✔ keyboard and SGR mouse input are recognized`
- `✔ device pairing code formats 8 characters into 4-4 with hyphen`
- `✔ PKCE S256 challenge matches RFC 7636 vector`
- `✔ PKCE pending login round-trips through secure store`
- `✔ PKCE pending login expires after 10 minutes`
- `✔ authorize URL validator rejects the broken client_id-only URL`
- `✔ authorize URL validator accepts a complete PKCE URL`
- `✔ startErpLogin sends PKCE challenge and exchange sends verifier`

---

## 📂 Project Structure

```text
terminal/
├── README.md           # Documentation & user guide
├── package.json        # Manifest, scripts, and bin entries
├── install.sh          # One-line Linux/macOS curl installer script
├── install.ps1         # Windows PowerShell installer script
├── src/
│   ├── index.js        # CLI router, argument parsing & TUI orchestrator
│   ├── tui.js          # Terminal rendering, ANSI layouts, mouse & modals
│   ├── player.js       # mpv / ffplay child process lifecycle manager
│   ├── stations.js     # Station registry, mounts, and codec definitions
│   ├── api.js          # REST client for auth, ERP, Gold, and Study
│   ├── gold.js         # Nonce-verified Gold listening heartbeat engine
│   ├── pkce.js         # RFC 7636 PKCE S256 challenge generation & storage
│   ├── metadata.js     # Icecast stream ICY metadata reader
│   └── store.js        # Local token persistence & session state storage
└── test/
    ├── api.test.js     # Auth & endpoint contracts tests
    ├── core.test.js    # Stations, player arguments & input tests
    └── pkce.test.js    # RFC 7636 security vector & validator tests
```

---

## 👤 Author & Maintainer

Developed and maintained with ❤️ by **Arda Akgül**:

- **GitHub**: [@akgularda](https://github.com/akgularda)
- **Repository**: [radiotedu/radiotedu-tui](https://github.com/radiotedu/radiotedu-tui)
- **Organization**: RadioTEDU Ankara Studios · TED University ([radiotedu.com](https://radiotedu.com))

---

## 📄 License

This software is part of the RadioTEDU ecosystem. All rights reserved.
© 2026 RadioTEDU Ankara Studios & TED University.
