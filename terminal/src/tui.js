const ESC = '\x1b[';

const {buildFrame, mouseAction} = require('./layout');

function draw(state) {
  state.layout = buildFrame(state, {columns: process.stdout.columns, rows: process.stdout.rows});
  const frame = `${ESC}H${state.layout.lines.join('\r\n')}${ESC}J`;
  if (frame !== state.previousFrame) {
    process.stdout.write(frame);
    state.previousFrame = frame;
  }
}

function parseInput(buffer) {
  const input = buffer.toString('utf8');
  if (input === '\u0003') return {type: 'key', key: 'q'};
  if (input === '\x1b') return {type: 'key', key: 'escape'};
  if (input === '\x7f' || input === '\b' || input === '\x08') return {type: 'key', key: 'backspace'};
  if (input === '\x1b[A' || input === 'k') return {type: 'key', key: 'up'};
  if (input === '\x1b[B' || input === 'j') return {type: 'key', key: 'down'};
  if (input === '\x1b[C') return {type: 'key', key: 'right'};
  if (input === '\x1b[D') return {type: 'key', key: 'left'};
  if (input === '\r' || input === '\n') return {type: 'key', key: 'enter'};
  if (input === ' ') return {type: 'key', key: 'space'};
  if (input === '\t') return {type: 'key', key: 'tab'};
  if (input === '+' || input === '=') return {type: 'key', key: 'volup'};
  if (input === '-' || input === '_') return {type: 'key', key: 'voldown'};
  const mouse = input.match(/^\x1b\[<([0-9]+);([0-9]+);([0-9]+)([mM])$/);
  if (mouse) return {type: 'mouse', button: Number(mouse[1]), x: Number(mouse[2]), y: Number(mouse[3]), release: mouse[4] === 'm'};
  if (input.length === 1) return {type: 'key', key: input.toLowerCase(), raw: input};
  return {type: 'key', key: input.toLowerCase(), raw: input};
}

async function runTui({
  stations,
  onPlay,
  onQuality,
  onPause,
  onVolume,
  onSetVolume,
  onStudy,
  onAccount,
  onLogin,
  onLoginCreds,
  onLoginPairStart,
  onLoginPairCode,
  onLoginDeviceStart = null,
  onLoginDevicePoll = null,
  onOpenExternal = null,
  onLogout,
  onQuit,
  onTick,
  onEnsureAudio = null,
  initialAccount = null,
  initialQuality = 'normal',
  playerName = null,
  autoPlay = false,
}) {
  return new Promise(resolve => {
    const state = {
      stations,
      selected: 0,
      active: null,
      metadata: null,
      quality: initialQuality,
      codec: 'HE-AAC v2',
      status: '',
      account: initialAccount,
      studyMinutes: null,
      pomodoro: {
        preset: '25/5',
        phase: 'focus',
        focusMinutes: 25,
        breakMinutes: 5,
        secondsLeft: 25 * 60,
        running: false,
        completedFocus: 0,
        completedBreak: 0,
      },
      paused: false,
      streamStartedAt: null,
      streamElapsedBeforePause: 0,
      playerName,
      activeTab: 1,
      volume: 80,
      focusedPanel: 'stations',
      modal: null,
    };

    let inputBuffer = '';
    let rendering = false;
    const render = () => {
      if (!rendering) {
        rendering = true;
        draw(state);
        rendering = false;
      }
    };
    state.requestRender = render;

    const cleanup = () => {
      clearInterval(timer);
      if (state.modal?.pollTimer) {
        clearInterval(state.modal.pollTimer);
        state.modal.pollTimer = null;
      }
      process.stdin.removeListener('data', dataHandler);
      process.stdout.removeListener('resize', render);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write(`${ESC}?25h${ESC}?1000l${ESC}?1006l${ESC}?1049l`);
    };

    const pauseInput = () => {
      process.stdin.removeListener('data', dataHandler);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write(`${ESC}?25h${ESC}?1000l${ESC}?1006l${ESC}2J${ESC}H`);
    };

    const resumeInput = () => {
      state.previousFrame = null;
      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      process.stdin.on('data', dataHandler);
      process.stdout.write(`${ESC}?25l${ESC}?1000h${ESC}?1006h`);
    };

    let pomoSubTick = 0;
    // Keep existing timer cadence for focus countdown and playback polling.
    const timer = setInterval(() => {
      let changed = false;
      if (state.pomodoro && state.pomodoro.running) {
        pomoSubTick = (pomoSubTick || 0) + 1;
        if (pomoSubTick >= 5) {
          pomoSubTick = 0;
          if (state.pomodoro.secondsLeft > 1) {
            state.pomodoro.secondsLeft--;
            changed = true;
          } else {
            // Completed current phase!
            if (state.pomodoro.phase === 'focus') {
              state.pomodoro.completedFocus++;
              state.pomodoro.phase = 'break';
              state.pomodoro.secondsLeft = state.pomodoro.breakMinutes * 60;
              state.status = `🍅 Focus complete! Time for a ${state.pomodoro.breakMinutes}m break.`;
              // Gold is authoritative server data, never a local timer reward.
            } else {
              state.pomodoro.completedBreak++;
              state.pomodoro.phase = 'focus';
              state.pomodoro.secondsLeft = state.pomodoro.focusMinutes * 60;
              state.status = `☕ Break finished! Ready for a ${state.pomodoro.focusMinutes}m focus session.`;
            }
            state.pomodoro.running = true;
            changed = true;
          }
        }
      }
      if (state.studyMinutes !== null) {
        state.studyMinutes += 0.2 / 60;
        changed = true;
      }
      if (state.active && !state.paused) {
        changed = true;
      }
      if (onTick?.(state)) changed = true;
      if (changed) render();
    }, 200);

    const triggerPlay = async (station) => {
      if (!station) return;
      if (state.active?.id === station.id) {
        if (state.paused) {
          state.paused = await onPause(state);
          if (!state.paused) state.streamStartedAt = Date.now();
        }
        return;
      }
      state.streamStartedAt = Date.now();
      state.streamElapsedBeforePause = 0;
      await onPlay(station, state);
      state.paused = false;
    };

    const togglePlayPause = async () => {
      if (!state.active) {
        state.streamStartedAt = Date.now();
        state.streamElapsedBeforePause = 0;
        await onPlay(stations[state.selected], state);
        state.paused = false;
      } else {
        const wasPaused = state.paused;
        state.paused = await onPause(state);
        if (state.paused && !wasPaused) {
          state.streamElapsedBeforePause += (Date.now() - (state.streamStartedAt || Date.now()));
          state.streamStartedAt = null;
        } else if (!state.paused && wasPaused) {
          state.streamStartedAt = Date.now();
        }
      }
    };

    const handle = async (event) => {
      if (!event) return;
      if (event.type === 'mouse') {
        if (!state.modal && (event.button === 64 || event.button === 65)) {
          if (stations.length) state.selected = (state.selected + (event.button === 64 ? -1 : 1) + stations.length) % stations.length;
          render();
          return;
        }
        const action = mouseAction(state.layout, event);
        if (!action) return;
        if (action.station !== undefined) {
          state.selected = action.station;
          await triggerPlay(stations[state.selected]);
          render();
          return;
        }
        event = {type: 'key', key: action.key};
      }

      // MODAL DIALOG INTERACTION
      if (state.modal) {
        if (event.type === 'key') {
          if (state.modal.type === 'audio_engine_missing') {
            if (event.key === '1' || event.key === 'enter') {
              state.modal.status = 'Ses motoru indiriliyor, lütfen bekleyin...';
              render();
              try {
                const downloaded = await onEnsureAudio?.(state);
                if (downloaded) {
                  state.playerName = downloaded.replace(/^.*[\\/]/, '');
                  state.modal = null;
                  state.status = 'Ses motoru başarıyla kuruldu!';
                  if (state.stations?.[state.selected]) {
                    await onPlay(state.stations[state.selected], state);
                  }
                } else {
                  state.modal.status = 'İndirme tamamlanamadı. winget install Gyan.FFmpeg deneyin.';
                }
              } catch (err) {
                state.modal.status = `Hata: ${err.message}`;
              }
              render();
              return;
            }
            if (event.key === 'escape' || event.key === 'q') {
              state.modal = null;
              render();
            }
            return;
          }

          if (event.key === 'escape' || (state.modal.type === 'choice' && event.key === 'q')) {
            if (state.modal.pollTimer) {
              clearInterval(state.modal.pollTimer);
              state.modal.pollTimer = null;
            }
            state.modal = null;
            render();
            return;
          }

          if (state.modal.type === 'device_poll') {
            if (event.key === 'escape' || event.key === 'q') {
              if (state.modal.pollTimer) {
                clearInterval(state.modal.pollTimer);
                state.modal.pollTimer = null;
              }
              state.modal = null;
              render();
              return;
            }
            if (event.key === 'o' || event.key === 'O') {
              if (state.modal.url) {
                try {
                  Promise.resolve(onOpenExternal?.(state.modal.url)).catch(() => {});
                } catch (e) {}
              }
              return;
            }
            return;
          }

          const startDeviceFlow = () => {
            state.modal = {
              type: 'device_poll',
              deviceToken: '',
              userCode: '...',
              url: 'https://radiotedu.com/device',
              status: 'Oturum başlatılıyor...',
              pollTimer: null,
            };
            render();

            (async () => {
              try {
                const init = await onLoginDeviceStart?.();
                if (!state.modal || state.modal.type !== 'device_poll') return;
                state.modal.deviceToken = init?.deviceToken || '';
                state.modal.userCode = init?.userCode || '--------';
                state.modal.url = init?.verificationUrl || 'https://radiotedu.com/device';
                state.modal.status = 'Tarayıcıda onay bekleniyor...';
                render();

                const timer = setInterval(async () => {
                  if (!state.modal || state.modal.type !== 'device_poll' || !state.modal.deviceToken) {
                    clearInterval(timer);
                    return;
                  }
                  try {
                    const pollRes = await onLoginDevicePoll?.(state.modal.deviceToken);
                    if (!state.modal || state.modal.type !== 'device_poll') {
                      clearInterval(timer);
                      return;
                    }
                    if (pollRes?.status === 'approved') {
                      clearInterval(timer);
                      if (state.modal) state.modal.pollTimer = null;
                      state.account = pollRes.user;
                      state.modal = null;
                      state.status = `Giriş başarılı · ${pollRes.user?.label || pollRes.user?.display_name || 'RadioTEDU'}`;
                      render();
                      return;
                    }
                    if (pollRes?.status === 'denied') {
                      clearInterval(timer);
                      if (state.modal) {
                        state.modal.pollTimer = null;
                        state.modal.status = 'Oturum isteği tarayıcıda reddedildi.';
                        render();
                      }
                      return;
                    }
                    if (pollRes?.status === 'expired') {
                      clearInterval(timer);
                      if (state.modal) {
                        state.modal.pollTimer = null;
                        state.modal.status = 'Oturum onay süresi doldu.';
                        render();
                      }
                      return;
                    }
                  } catch (err) {
                    // ignore transient network errors during polling
                  }
                }, (init?.interval || 2) * 1000);

                if (state.modal) {
                  state.modal.pollTimer = timer;
                }
              } catch (err) {
                if (state.modal && state.modal.type === 'device_poll') {
                  state.modal.status = `Hata: ${err?.message || err}`;
                  render();
                }
              }
            })();
          };

          if (state.modal.type === 'choice') {
            if (event.key === '1') {
              startDeviceFlow();
              return;
            }
            if (event.key === '2') {
              state.modal = {type: 'creds', field: 'email', email: '', password: '', status: ''};
              render();
              return;
            }
            if (event.key === '3') {
              state.modal = {type: 'pair', code: '', status: 'Tarayıcıda radiotedu.com/erp/device açılıyor...'};
              render();
              try {
                Promise.resolve(onLoginPairStart?.()).catch((err) => {
                  if (state.modal) state.modal.status = `Tarayıcı açılamadı: ${err?.message || err}`;
                  render();
                });
              } catch (err) {
                if (state.modal) state.modal.status = `Tarayıcı açılamadı: ${err?.message || err}`;
                render();
              }
              return;
            }
            return;
          }

          if (state.modal.type === 'creds') {
            if (event.key === 'tab') {
              state.modal.field = state.modal.field === 'email' ? 'password' : 'email';
              render();
              return;
            }
            if (event.key === 'backspace') {
              state.modal[state.modal.field] = state.modal[state.modal.field].slice(0, -1);
              render();
              return;
            }
            if (event.key === 'enter') {
              if (state.modal.field === 'email' && !state.modal.password) {
                state.modal.field = 'password';
                render();
                return;
              }
              if (!state.modal.email || !state.modal.password) {
                state.modal.status = 'E-posta ve şifre gereklidir.';
                render();
                return;
              }
              state.modal.status = 'Giriş yapılıyor, lütfen bekleyin...';
              render();
              try {
                const acc = await onLoginCreds?.(state.modal.email, state.modal.password);
                state.account = acc;
                state.modal = null;
                state.status = `Giriş başarılı · ${acc.label}`;
              } catch (err) {
                state.modal.status = `Hata: ${err.message}`;
              }
              render();
              return;
            }
            const char = event.raw || (event.key === 'space' ? ' ' : event.key);
            if (char && char.length === 1 && !char.startsWith('\x1b') && char !== '\r' && char !== '\n' && char !== '\t') {
              state.modal[state.modal.field] += char;
              render();
              return;
            }
            return;
          }

          if (state.modal.type === 'pair') {
            if (event.key === 'backspace') {
              if (state.modal.code.endsWith('-')) {
                state.modal.code = state.modal.code.slice(0, -2);
              } else {
                state.modal.code = state.modal.code.slice(0, -1);
              }
              render();
              return;
            }
            if (event.key === 'enter') {
              const cleanCode = state.modal.code.trim();
              if (!cleanCode || cleanCode.replace(/[^A-Za-z0-9]/g, '').length < 8) {
                state.modal.status = 'Lütfen 8 haneli kodu girin (örn: AAAA-BBBB).';
                render();
                return;
              }
              state.modal.status = 'Doğrulanıyor, lütfen bekleyin...';
              render();
              try {
                const acc = await onLoginPairCode?.(cleanCode);
                state.account = acc;
                state.modal = null;
                state.status = `Giriş başarılı · ${acc.label}`;
              } catch (err) {
                state.modal.status = `Hata: ${err.message}`;
              }
              render();
              return;
            }
            const raw = event.raw || event.key;
            if (raw && raw.length === 1 && !raw.startsWith('\x1b') && raw !== '\r' && raw !== '\n' && raw !== '\t') {
              const char = raw.toUpperCase();
              if (/^[A-Z0-9]$/.test(char) && state.modal.code.length < 9) {
                if (state.modal.code.length === 4 && !state.modal.code.includes('-')) {
                  state.modal.code += '-';
                }
                state.modal.code += char;
                if (state.modal.code.length === 4) state.modal.code += '-';
                render();
                return;
              }
            }
            return;
          }
        }

        // Mouse clicks on modal
        if (event.type === 'mouse' && event.button === 0 && event.release) {
          if (state.modal.type === 'audio_engine_missing') {
            state.modal = null;
            render();
            return;
          }
          if (state.modal.type === 'choice') {
            if (event.y === 7) {
              startDeviceFlow();
              return;
            }
            if (event.y === 8) {
              state.modal = {type: 'creds', field: 'email', email: '', password: '', status: ''};
              render();
              return;
            }
            if (event.y === 9) {
              state.modal = {type: 'pair', code: '', status: 'Tarayıcıda radiotedu.com/erp/device açılıyor...'};
              render();
              try {
                Promise.resolve(onLoginPairStart?.()).catch((err) => {
                  if (state.modal) state.modal.status = `Tarayıcı açılamadı: ${err?.message || err}`;
                  render();
                });
              } catch (err) {
                if (state.modal) state.modal.status = `Tarayıcı açılamadı: ${err?.message || err}`;
                render();
              }
              return;
            }
            if (event.y >= 11) {
              if (state.modal.pollTimer) {
                clearInterval(state.modal.pollTimer);
                state.modal.pollTimer = null;
              }
              state.modal = null;
              render();
              return;
            }
          }
          if (state.modal.type === 'device_poll') {
            if (event.y >= 11) {
              if (state.modal.pollTimer) {
                clearInterval(state.modal.pollTimer);
                state.modal.pollTimer = null;
              }
              state.modal = null;
              render();
              return;
            }
          }
          if (state.modal.type === 'creds') {
            if (event.y === 7) { state.modal.field = 'email'; render(); return; }
            if (event.y === 8) { state.modal.field = 'password'; render(); return; }
          }
        }
        return;
      }

      // MOUSE SUPPORT
      // KEYBOARD SUPPORT
      if (event.type === 'key') {
        switch (event.key) {
          case '1': state.activeTab = 1; render(); break;
          case '2': state.activeTab = 2; render(); break;
          case '3': state.activeTab = 3; render(); break;
          case '4': state.activeTab = 4; render(); break;
          case 'tab':
            state.focusedPanel = state.focusedPanel === 'stations' ? 'main' : 'stations';
            render();
            break;
          case 'up':
            state.selected = (state.selected - 1 + stations.length) % stations.length;
            render();
            break;
          case 'down':
            state.selected = (state.selected + 1) % stations.length;
            render();
            break;
          case 'enter':
            await triggerPlay(stations[state.selected]);
            render();
            break;
          case 'space':
            await togglePlayPause();
            render();
            break;
          case 'p':
            if (state.activeTab === 3) {
              if (state.pomodoro.preset === '25/5') {
                state.pomodoro.preset = '50/10';
                state.pomodoro.focusMinutes = 50;
                state.pomodoro.breakMinutes = 10;
              } else {
                state.pomodoro.preset = '25/5';
                state.pomodoro.focusMinutes = 25;
                state.pomodoro.breakMinutes = 5;
              }
              state.pomodoro.phase = 'focus';
              state.pomodoro.secondsLeft = state.pomodoro.focusMinutes * 60;
              state.pomodoro.running = false;
              state.status = `Switched preset to ${state.pomodoro.preset}`;
              render();
            } else {
              await togglePlayPause();
              render();
            }
            break;
          case 'b':
            if (state.activeTab === 3) {
              if (state.pomodoro.phase === 'focus') {
                state.pomodoro.phase = 'break';
                state.pomodoro.secondsLeft = state.pomodoro.breakMinutes * 60;
              } else {
                state.pomodoro.phase = 'focus';
                state.pomodoro.secondsLeft = state.pomodoro.focusMinutes * 60;
              }
              state.pomodoro.running = false;
              state.status = `Switched to ${state.pomodoro.phase === 'focus' ? 'Focus' : 'Break'} phase`;
              render();
            }
            break;
          case 'r':
            if (state.activeTab === 3) {
              const total = (state.pomodoro.phase === 'focus' ? state.pomodoro.focusMinutes : state.pomodoro.breakMinutes) * 60;
              state.pomodoro.secondsLeft = total;
              state.pomodoro.running = false;
              state.status = 'Focus timer reset';
              render();
            }
            break;
          case 'f':
            state.quality = onQuality(state);
            render();
            break;
          case 'v':
            state.activeTab = state.activeTab === 2 ? 1 : 2;
            render();
            break;
          case 'volup':
          case '+':
          case '=':
            state.volume = onVolume ? onVolume(5, state) : Math.min(100, state.volume + 5);
            render();
            break;
          case 'voldown':
          case '-':
          case '_':
            state.volume = onVolume ? onVolume(-5, state) : Math.max(0, state.volume - 5);
            render();
            break;
          case 'm':
            state.volume = state.volume > 0 ? (onSetVolume ? onSetVolume(0, state) : 0) : (onSetVolume ? onSetVolume(80, state) : 80);
            render();
            break;
          case 'l':
            state.modal = { type: 'choice' };
            render();
            break;
          case 'x':
            state.account = await onLogout();
            render();
            break;
          case 's':
            if (state.activeTab === 3) {
              state.pomodoro.running = !state.pomodoro.running;
              state.status = state.pomodoro.running ? 'Focus session running' : 'Focus session paused';
            } else {
              state.activeTab = 3;
              state.pomodoro.running = true;
              state.status = 'Focus session active (25/5)';
            }
            render();
            break;
          case 'a':
            state.account = await onAccount();
            render();
            break;
          case 'q':
            cleanup();
            onQuit();
            resolve();
            break;
        }
      }

    };

    const dataHandler = async (chunk) => {
      inputBuffer += chunk.toString('utf8');
      while (inputBuffer.length > 0) {
        if (inputBuffer.startsWith('\x1b[<')) {
          const m = inputBuffer.match(/^\x1b\[<[0-9]+;[0-9]+;[0-9]+[mM]/);
          if (m) {
            const event = parseInput(Buffer.from(m[0], 'utf8'));
            inputBuffer = inputBuffer.slice(m[0].length);
            await handle(event);
            continue;
          }
          if (inputBuffer.length < 16) break;
        }
        if (inputBuffer.startsWith('\x1b')) {
          const escSeq = inputBuffer.match(/^\x1b(?:\[[A-Z0-9]+|.)?/);
          if (escSeq) {
            const event = parseInput(Buffer.from(escSeq[0], 'utf8'));
            inputBuffer = inputBuffer.slice(escSeq[0].length);
            await handle(event);
            continue;
          }
        }
        const ch = inputBuffer[0];
        inputBuffer = inputBuffer.slice(1);
        await handle(parseInput(Buffer.from(ch, 'utf8')));
      }
    };

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', dataHandler);
    process.stdout.on('resize', render);
    process.stdout.write(`${ESC}?1049h${ESC}2J${ESC}?25l${ESC}?1000h${ESC}?1006h`);
    render();

    if (autoPlay && stations.length > 0) {
      setImmediate(async () => {
        try {
          await onPlay(stations[0], state);
          state.paused = false;
          render();
        } catch (err) {
          state.status = `Audio error: ${err.message}`;
          render();
        }
      });
    }
  });
}

module.exports = {runTui, parseInput};
