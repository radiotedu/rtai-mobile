#!/usr/bin/env bash
set -e

# radiotedu-tui Installer (Spotify-tui inspired CLI)
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
echo "                 radiotedu-tui                   "
echo -e "${NC}"
echo -e "${CYAN}Installing radiotedu-tui (Spotify-tui inspired CLI player)...${NC}"
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

# 3. Install radiotedu-tui globally via npm
echo ""
echo -e "${CYAN}Installing radiotedu-tui globally...${NC}"
npm install -g "git+https://github.com/radiotedu/rtai-mobile.git#main:terminal"

# 4. Verify Installation
if command -v radiotedu >/dev/null 2>&1; then
  echo ""
  echo -e "${GREEN}${BOLD}✓ Successfully installed $(radiotedu --version)!${NC}"
  echo ""
  echo -e "${BOLD}To start the interactive Spotify-style player:${NC}"
  echo -e "  ${GREEN}radiotedu${NC}  or  ${GREEN}radiotedu-tui${NC}"
  echo ""
  echo -e "${BOLD}Dashboard Layout & Features:${NC}"
  echo "  • [1: Stations] [2: Visualizer] [3: Study & Lyrics] [4: Account]"
  echo "  • Real-time Audio Spectrum Equalizer (cava style)"
  echo "  • Spotify playbar with live progress and volume control"
  echo "  • Full mouse support: click stations, tabs, volume, buttons"
  echo "  • RadioTEDU & TEDÜ ERP SSO login with Gold rewards"
  echo ""
else
  echo -e "${RED}Installation finished, but 'radiotedu' command is not on PATH.${NC}"
  echo "Please ensure your npm global bin directory is in PATH."
fi
