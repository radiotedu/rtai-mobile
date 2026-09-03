#!/usr/bin/env bash
set -e

# RadioTEDU Terminal Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/radiotedu/rtai-mobile/main/terminal/install.sh | bash

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${RED}${BOLD}"
echo "  ____           _ _     _____ _____ ____  _   _ "
echo " |  _ \ __ _  __| (_)___|_   _| ____|  _ \| | | |"
echo " | |_) / _\` |/ _\` | / _ \ | | |  _| | | | | | | |"
echo " |  _ < (_| | (_| | | (_) || | | |___| |_| | |_| |"
echo " |_| \_\__,_|\__,_|_|\___/ |_| |_____|____/ \___/ "
echo "                 TERMINAL CLI                    "
echo -e "${NC}"
echo -e "${CYAN}Installing RadioTEDU Terminal Player (Spotify-inspired TUI)...${NC}"
echo ""

# 1. Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}Error: Node.js is required but not found.${NC}"
  echo "Please install Node.js 18+ from https://nodejs.org or via your package manager:"
  echo "  macOS:  brew install node"
  echo "  Ubuntu/Debian: sudo apt install nodejs npm"
  echo "  Arch:   sudo pacman -S nodejs npm"
  exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${YELLOW}Warning: Node.js 18+ is recommended. Found: $(node -v)${NC}"
fi

# 2. Check Audio Engine (mpv / ffplay)
if command -v mpv >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Found audio player: mpv${NC}"
elif command -v ffplay >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Found audio player: ffplay${NC}"
else
  echo -e "${YELLOW}! Neither mpv nor ffplay was found on PATH.${NC}"
  echo -e "  For audio playback, please install mpv (recommended) or ffmpeg:"
  echo "    macOS:  brew install mpv"
  echo "    Ubuntu/Debian: sudo apt install mpv"
  echo "    Arch:   sudo pacman -S mpv"
fi

# 3. Install RadioTEDU CLI via npm
echo ""
echo -e "${CYAN}Fetching and installing radiotedu package...${NC}"

TARGET_URL="https://github.com/radiotedu/rtai-mobile/releases/download/v1.3.5/radiotedu-1.3.5.tgz"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

if curl -fsSL "$TARGET_URL" -o "$TMP_DIR/radiotedu.tgz" 2>/dev/null; then
  echo -e "${CYAN}Installing from release bundle...${NC}"
  npm install -g "$TMP_DIR/radiotedu.tgz"
else
  echo -e "${CYAN}Installing from Git repository...${NC}"
  npm install -g "git+https://github.com/radiotedu/rtai-mobile.git#main:terminal"
fi

# 4. Verify Installation
if command -v radiotedu >/dev/null 2>&1; then
  echo ""
  echo -e "${GREEN}${BOLD}✓ Successfully installed $(radiotedu --version)!${NC}"
  echo ""
  echo -e "${BOLD}To start the interactive player:${NC}"
  echo -e "  ${GREEN}radiotedu${NC}"
  echo ""
  echo -e "${BOLD}Mouse & Keyboard Controls:${NC}"
  echo "  • Mouse Wheel / Arrows : Navigate stations"
  echo "  • Left Click / Enter   : Play selected station"
  echo "  • Space / P            : Pause / Resume"
  echo "  • F                    : Toggle Quality (Normal, Low, FLAC)"
  echo "  • L                    : Sign In (RadioTEDU / TEDÜ SSO)"
  echo "  • X                    : Sign Out"
  echo "  • S                    : Study Session Timer"
  echo "  • Q                    : Quit"
  echo ""
else
  echo -e "${RED}Installation finished, but 'radiotedu' command is not on PATH.${NC}"
  echo "Please ensure npm global bin directory is in your PATH (e.g. $(npm bin -g 2>/dev/null || echo '~/.npm-global/bin'))."
fi
