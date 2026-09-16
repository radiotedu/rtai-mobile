/**
 * RadioTEDU Wrapped Summary Generator
 * 
 * Provides personalized listening story, stream milestones, campus Study stats,
 * and Gold rewards with strict RadioTEDU brand casing preservation.
 */

function padRight(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function getWrappedSummary(options = {}) {
  const account = options.account || {label: 'RadioTEDU Member', gold: 0};
  const listeningMinutes = Number(options.listeningMinutes ?? 1420);
  const topStation = options.topStation || 'RadioTEDU';
  const favoriteQuality = options.favoriteQuality || 'HE-AAC v2 (64 kbps)';
  const studyMinutes = Number(options.studyMinutes ?? 350);
  const pomodorosCompleted = Number(options.pomodorosCompleted ?? 14);
  const goldEarned = Number(options.goldEarned ?? (account.gold || 85));
  const listeningHours = (listeningMinutes / 60).toFixed(1);

  const formattedBox = [
    '╔═══════════════════════════════════════════════════════════════════╗',
    '║                    ✨ RadioTEDU WRAPPED 2026 ✨                   ║',
    '╠═══════════════════════════════════════════════════════════════════╣',
    `║  Listener:         ${padRight(account.label, 44)}║`,
    `║  Top Station:      ${padRight(topStation, 44)}║`,
    `║  Total Listening:  ${padRight(`${listeningMinutes} mins (${listeningHours} hrs)`, 44)}║`,
    `║  Audio Quality:    ${padRight(favoriteQuality, 44)}║`,
    `║  Gold Earned:      ${padRight(`+${goldEarned} Gold`, 44)}║`,
    `║  Campus Study:     ${padRight(`${studyMinutes} mins (${pomodorosCompleted} sessions)`, 44)}║`,
    '╠═══════════════════════════════════════════════════════════════════╣',
    '║  Loudness Standard: ITU-R BS.1770-5 / EBU R128 (-16 LUFS)         ║',
    '║  RadioTEDU Ankara Studios · radiotedu.com                         ║',
    '╚═══════════════════════════════════════════════════════════════════╝',
  ].join('\n');

  return {
    year: 2026,
    title: 'RadioTEDU Wrapped 2026',
    subtitle: 'Your RadioTEDU Listening & Campus Story',
    account: account.label,
    topStation,
    listeningMinutes,
    listeningHours,
    favoriteQuality,
    goldEarned,
    studyMinutes,
    pomodorosCompleted,
    highlights: [
      `Favorite Station: ${topStation}`,
      `Total Listening: ${listeningMinutes} mins (${listeningHours} hrs)`,
      `Gold Earned: +${goldEarned} Gold`,
      `Campus Focus: ${studyMinutes} mins · ${pomodorosCompleted} Pomodoro sessions`,
      `Audio Quality: ${favoriteQuality}`,
    ],
    formattedBox,
  };
}

module.exports = {getWrappedSummary};
