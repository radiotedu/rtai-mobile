# RadioTEDU Terminal

A responsive radio player with keyboard and mouse controls, a focus timer and server-backed account balances. Version **1.3.7**.

## Interface

RadioTEDU burgundy, warm white and slate keep stations, playback and controls readable. The layout follows the terminal dimensions, scrolls the station selection into view and restores your shell when you quit. Use **Cascadia Mono** or **JetBrains Mono** in your terminal settings; the application respects the host font.

Four views: Stations, Audio, Focus and Account. Audio reports the selected stream format and player status. It does not claim to measure signal strength, bit depth or a live spectrum. Gold comes from the server; completing a local focus timer does not manufacture a reward.

All existing stations remain available, including Lo-Fi, Classical and Jazz FLAC. Stream availability depends on the broadcast service. There are no external npm runtime dependencies.

## 🚀 Installation & Quick Start

### Prerequisites

1. **Node.js**: Version 18.0.0 or higher.
2. **Audio Player Engine**: Supported engines are `mpv` (recommended) or `ffplay`. *(If neither is installed, `radiotedu-tui` offers to download a lightweight `ffplay` audio binary with your confirmation on Windows & Linux).*

---

### Option 1: Windows Installation (CMD & PowerShell)

Direct global installation via npm (Node.js package):

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
| `1` | Switch to **Tab 1: Stations** |
| `2` | Switch to **Tab 2: Audio output** |
| `3` | Switch to **Tab 3: Focus timer** |
| `4` | Switch to **Tab 4: Account & Gold Balance** |
| `Tab` | Cycle active focus between interface panels |
| `v` | Switch between Audio and Stations |

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

Click a tab, station or labeled action. Mouse targets follow the responsive layout. Scroll selects a station; Enter plays it. In Focus, S starts/pauses, P changes preset, B changes phase and R resets the timer. Authentication dialogs mask passwords and retain keyboard controls.

---

## 📻 Stations & Stream Qualities

RadioTEDU broadcasts across 9 official mounts, supporting multi-quality fallback and lossless audiophile delivery:

| Station | Genre / Purpose | Qualities Supported | Default Codec | Lossless FLAC |
| :--- | :--- | :--- | :--- | :---: |
| **RadioTEDU** | Flagship Campus Channel | `Normal`, `Low` | HE-AAC v2 | — |
| **Classical** | Symphonic, Concerto & Chamber | `Normal`, `Low`, `FLAC` | HE-AAC v2 | ✅ **FLAC** |
| **Jazz** | Bebop, Soul, Swing & Modern Jazz | `Normal`, `Low`, `FLAC` | HE-AAC v2 | ✅ **FLAC** |
| **Lo-Fi** | Chillhop Beats for studying | `Normal`, `Low` | HE-AAC v2 | — |
| **Energize** | High-tempo workout & EDM | `Normal`, `Low` | HE-AAC v2 | — |
| **Rock** | Classic Rock & Alternative | `Normal`, `Low` | HE-AAC v2 | — |
| **English** | International Campus Broadcast | `Normal` | MP3 | — |
| **Français** | French Language Broadcast | `Normal` | MP3 | — |
| **Voting** | Interactive live listener-voted stream | `Normal` | Ogg/Opus | — |

> 💡 **Tip**: Press `f` or click `[F]` to cycle through available stream qualities. When tuning to `FLAC` on metered connections, confirmation is requested to prevent unintended data usage.

---

## 🔐 Authentication & Single Sign-On

`radiotedu-tui` provides a unified sign-in flow supporting automated browser device pairing, direct email/password login, and TEDÜ ERP SSO:

```text
╭─ 🔐 RADIOTEDU SIGN IN // HESAP GİRİŞİ ────────────────────────╮
│  Lütfen oturum açma yöntemini seçin:                         │
│                                                              │
│  [1] 🌐 Web ile Hızlı Oturum Aç (Otomatik Onay)              │
│  [2] 📧 RadioTEDU Hesabı (E-Posta & Şifre)                   │
│  [3] 🏛️ TEDÜ / ERP Girişi (8 Haneli Kod: AAAA-BBBB)          │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│  Klavyeden [1], [2] veya [3]'e basın  ·  [Esc] İptal         │
╰──────────────────────────────────────────────────────────────╯
```

### 1. Web ile Hızlı Oturum Aç (Otomatik Onay — Önerilen)
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

## 📻 Organization & Community

Developed and maintained by **RadioTEDU**:

- **Website**: [radiotedu.com](https://radiotedu.com)
- **Repository**: [radiotedu/radiotedu-tui](https://github.com/radiotedu/radiotedu-tui)
- **Organization**: RadioTEDU Ankara Studios · TED University ([radiotedu.com](https://radiotedu.com))

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
Copyright (c) 2026 RadioTEDU (RadioTEDU Ankara Studios & TED University).
