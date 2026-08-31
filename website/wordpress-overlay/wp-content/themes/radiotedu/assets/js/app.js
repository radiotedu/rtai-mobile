(() => {
    'use strict';

    const config = window.RadioTEDUConfig || {};
    const t = (turkish, english) => config.language === 'en' ? english : turkish;
    const route = (turkish, english) => `${config.homeUrl || '/'}${config.language === 'en' ? english : turkish}/`;
    const player = document.querySelector('[data-rt-player]');
    if (!player) return;

    const audio = new Audio();
    audio.preload = 'none';

    const state = {
        kind: null,
        id: null,
        src: null,
        title: 'RadioTEDU',
        subtitle: '',
        artwork: '',
        csrf: null,
        session: null,
        profile: null,
        navigationController: null,
        progressTimer: null,
        accountModalTrigger: null,
        verifiedListening: null,
        verifiedListeningTimer: null,
        erpPopup: null,
        liveMetadata: null,
        metadataTimer: null,
        metadataController: null,
        lyricsController: null,
        lyricsTimer: null,
        lyricsLines: [],
        lyricsTrackKey: null,
        lyricsBaseAudioTime: null,
        lyricsStartedAtMs: null,
        analyticsQuartiles: new Set(),
        analyticsTrackKey: null,
    };

    const els = {
        art: player.querySelector('[data-rt-player-art]'),
        type: player.querySelector('[data-rt-player-type]'),
        title: player.querySelector('[data-rt-player-title]'),
        subtitle: player.querySelector('[data-rt-player-subtitle]'),
        toggle: player.querySelector('[data-rt-player-toggle]'),
        favorite: player.querySelector('[data-rt-player-favorite]'),
        seek: player.querySelector('[data-rt-seek]'),
        volume: player.querySelector('[data-rt-volume]'),
        current: player.querySelector('[data-rt-current-time]'),
        duration: player.querySelector('[data-rt-duration]'),
        status: player.querySelector('[data-rt-player-status]'),
        expand: player.querySelector('[data-rt-player-expand]'),
        store: player.querySelector('[data-rt-player-store]'),
        storeToggle: player.querySelector('[data-rt-player-store-toggle]'),
        storeMenu: player.querySelector('[data-rt-player-store-menu]'),
        buyApple: player.querySelector('[data-rt-buy-apple]'),
        buyAmazon: player.querySelector('[data-rt-buy-amazon]'),
        lyrics: player.querySelector('[data-rt-player-lyrics]'),
        lyricsPrevious: player.querySelector('[data-rt-lyrics-previous]'),
        lyricsCurrent: player.querySelector('[data-rt-lyrics-current]'),
        lyricsNext: player.querySelector('[data-rt-lyrics-next]'),
        progress: document.querySelector('.rt-route-progress'),
    };
    const defaultPlayerArtwork = els.art.currentSrc || els.art.src;

    const apiData = async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.success === false) {
            throw new Error(body.error || body.message || `HTTP ${response.status}`);
        }
        return Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
    };

    const accountFetch = async (path, options = {}, mayRefresh = true) => {
        const headers = new Headers(options.headers || {});
        headers.set('Accept', 'application/json');
        if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        if (state.csrf && !['GET', 'HEAD'].includes(String(options.method || 'GET').toUpperCase())) {
            headers.set('X-RadioTEDU-CSRF', state.csrf);
        }
        const response = await fetch(`${config.accountBase || '/jukebox/api/v1/'}${path.replace(/^\//, '')}`, {
            ...options,
            headers,
            credentials: 'same-origin',
        });
        if (response.status === 401 && mayRefresh && !String(path).includes('auth/web/refresh')) {
            const refreshed = await fetch(`${config.accountBase || '/jukebox/api/v1/'}auth/web/refresh`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: '{}',
            });
            if (refreshed.ok) {
                const data = await apiData(refreshed);
                state.csrf = data.csrf_token || state.csrf;
                return accountFetch(path, options, false);
            }
        }
        return apiData(response);
    };

    const showStatus = (message, timeout = 3600) => {
        els.status.textContent = message || '';
        window.clearTimeout(showStatus.timer);
        if (message) showStatus.timer = window.setTimeout(() => { els.status.textContent = ''; }, timeout);
    };

    const formatTime = (seconds) => {
        if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const rest = Math.floor(seconds % 60);
        return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
    };

    const hasAnalyticsConsent = () => {
        const row = document.cookie.split('; ').find((item) => item.startsWith('rt_cookie_consent_v1='));
        if (!row) return false;
        try { return /^a1m[01]\./.test(decodeURIComponent(row.split('=').slice(1).join('='))); }
        catch (_) { return false; }
    };

    const trackPlayerAnalytics = (eventName, details = {}) => {
        if (!hasAnalyticsConsent() || typeof window.gtag !== 'function') return;
        const now = new Date();
        const contentType = state.kind === 'podcast' ? 'podcast' : 'radio';
        window.gtag('event', eventName, {
            surface: 'website_player',
            content_type: contentType,
            content_id: String(state.id || '').slice(0, 120),
            station_id: contentType === 'radio' ? String(state.id || '').slice(0, 80) : '',
            content_title: String(state.liveMetadata?.track || state.title || '').slice(0, 120),
            content_artist: String(state.liveMetadata?.artist || state.subtitle || '').slice(0, 120),
            local_hour: now.getHours(),
            local_weekday: now.getDay(),
            page_path: location.pathname,
            ...details,
        });
    };

    const isLofiStation = () => state.kind === 'station' && /lo-?fi/i.test(`${state.id || ''} ${state.title || ''}`);

    const normalizeLyricsValue = (value) => String(value || '')
        .toLocaleLowerCase('en-US')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(/\b(feat|featuring|ft)\.?\b.*$/i, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const parseSyncedLyrics = (source) => {
        const lines = [];
        String(source || '').split(/\r?\n/).forEach((row) => {
            const text = row.replace(/\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
            if (!text) return;
            const stamps = [...row.matchAll(/\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
            stamps.forEach((match) => {
                const hours = Number(match[1] || 0);
                const minutes = Number(match[2] || 0);
                const seconds = Number(match[3] || 0);
                const fraction = Number(`0.${match[4] || 0}`);
                lines.push({ at: (hours * 3600) + (minutes * 60) + seconds + fraction, text });
            });
        });
        return lines.sort((left, right) => left.at - right.at);
    };

    const clearLyrics = () => {
        state.lyricsController?.abort();
        state.lyricsController = null;
        window.clearInterval(state.lyricsTimer);
        state.lyricsTimer = null;
        state.lyricsLines = [];
        state.lyricsTrackKey = null;
        state.lyricsBaseAudioTime = null;
        state.lyricsStartedAtMs = null;
        if (els.lyrics) els.lyrics.hidden = true;
        [els.lyricsPrevious, els.lyricsCurrent, els.lyricsNext].forEach((line) => {
            if (line) line.textContent = '';
        });
    };

    const currentLyricsTime = () => {
        if (Number.isFinite(state.lyricsBaseAudioTime) && Number.isFinite(audio.currentTime)) {
            return Math.max(0, audio.currentTime - state.lyricsBaseAudioTime);
        }
        if (Number.isFinite(state.lyricsStartedAtMs)) {
            return Math.max(0, (Date.now() - state.lyricsStartedAtMs) / 1000);
        }
        return 0;
    };

    const renderLyrics = () => {
        if (!els.lyrics || !state.lyricsLines.length) return;
        const position = currentLyricsTime();
        let low = 0;
        let high = state.lyricsLines.length - 1;
        let active = -1;
        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            if (state.lyricsLines[middle].at <= position + 0.12) {
                active = middle;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }
        if (els.lyricsPrevious) els.lyricsPrevious.textContent = active > 0 ? state.lyricsLines[active - 1].text : '';
        if (els.lyricsCurrent) els.lyricsCurrent.textContent = active >= 0 ? state.lyricsLines[active].text : '…';
        if (els.lyricsNext) els.lyricsNext.textContent = state.lyricsLines[active + 1]?.text || '';
    };

    const lyricsMatchScore = (candidate, track, artist) => {
        const wantedTrack = normalizeLyricsValue(track);
        const wantedArtist = normalizeLyricsValue(artist);
        const resultTrack = normalizeLyricsValue(candidate.trackName || candidate.name);
        const resultArtist = normalizeLyricsValue(candidate.artistName);
        if (!wantedTrack || !resultTrack) return -1;
        let score = resultTrack === wantedTrack ? 12 : (resultTrack.includes(wantedTrack) || wantedTrack.includes(resultTrack) ? 5 : -8);
        if (wantedArtist) score += resultArtist === wantedArtist ? 8 : (resultArtist.includes(wantedArtist) || wantedArtist.includes(resultArtist) ? 3 : -5);
        return score;
    };

    const loadLyrics = async (track, artist, startedAt, trackKey) => {
        clearLyrics();
        if (!els.lyrics || !track || state.kind !== 'station' || isLofiStation()) return;
        state.lyricsTrackKey = trackKey;
        const controller = new AbortController();
        state.lyricsController = controller;
        try {
            const query = new URLSearchParams({ track_name: track, artist_name: artist });
            const response = await fetch(`https://lrclib.net/api/search?${query}`, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) return;
            const results = await response.json();
            if (!Array.isArray(results) || state.lyricsTrackKey !== trackKey) return;
            const match = results
                .filter((candidate) => !candidate.instrumental && candidate.syncedLyrics)
                .map((candidate) => ({ candidate, score: lyricsMatchScore(candidate, track, artist) }))
                .filter((entry) => entry.score >= 8)
                .sort((left, right) => right.score - left.score)[0]?.candidate;
            if (!match || state.lyricsTrackKey !== trackKey) return;
            const lines = parseSyncedLyrics(match.syncedLyrics);
            if (!lines.length) return;
            const parsedStart = Date.parse(startedAt || '');
            const startedAtMs = Number.isFinite(parsedStart) ? parsedStart : Date.now();
            const elapsed = Math.max(0, (Date.now() - startedAtMs) / 1000);
            state.lyricsLines = lines;
            state.lyricsStartedAtMs = startedAtMs;
            state.lyricsBaseAudioTime = Number.isFinite(audio.currentTime) ? audio.currentTime - elapsed : null;
            els.lyrics.hidden = false;
            renderLyrics();
            state.lyricsTimer = window.setInterval(renderLyrics, 250);
            trackPlayerAnalytics('lyrics_available', { lyrics_provider: 'lrclib', lyrics_synced: true });
        } catch (error) {
            if (error.name !== 'AbortError') clearLyrics();
        } finally {
            if (state.lyricsController === controller) state.lyricsController = null;
        }
    };

    const displayMedia = () => ({
        title: state.kind === 'station' && state.liveMetadata?.track ? state.liveMetadata.track : (state.title || 'RadioTEDU'),
        subtitle: state.kind === 'station' && state.liveMetadata?.track
            ? (state.liveMetadata.artist || state.title || 'RadioTEDU')
            : (state.subtitle || ''),
        artwork: state.kind === 'station' && state.liveMetadata?.artwork
            ? state.liveMetadata.artwork
            : (state.artwork || defaultPlayerArtwork),
    });

    const closeStoreMenu = (restoreFocus = false) => {
        if (!els.storeMenu || !els.storeToggle) return;
        els.storeMenu.hidden = true;
        els.storeToggle.setAttribute('aria-expanded', 'false');
        if (restoreFocus) els.storeToggle.focus({ preventScroll: true });
    };

    const setStoreLink = (anchor, url) => {
        if (!anchor) return;
        const visible = typeof url === 'string' && /^https:\/\//i.test(url);
        anchor.hidden = !visible;
        anchor.href = visible ? url : '#';
    };

    const mediaSession = () => {
        if (!('mediaSession' in navigator)) return;
        const display = displayMedia();
        navigator.mediaSession.metadata = new MediaMetadata({
            title: display.title,
            artist: display.subtitle || 'RadioTEDU',
            album: state.kind === 'station' ? t('CanlÄ± yayÄ±n', 'Live radio') : 'RadioTEDU Podcast',
            artwork: display.artwork ? [{ src: display.artwork }] : [],
        });
        const actions = {
            play: () => audio.play(),
            pause: () => audio.pause(),
            seekbackward: (event) => { if (state.kind === 'podcast') audio.currentTime = Math.max(0, audio.currentTime - (event.seekOffset || 15)); },
            seekforward: (event) => { if (state.kind === 'podcast') audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (event.seekOffset || 30)); },
        };
        Object.entries(actions).forEach(([name, handler]) => {
            try { navigator.mediaSession.setActionHandler(name, handler); } catch (_) { /* unsupported action */ }
        });
    };

    const updatePlayer = () => {
        const display = displayMedia();
        player.dataset.kind = state.kind || '';
        els.type.textContent = state.kind === 'podcast' ? 'Podcast' : t('CanlÄ±', 'Live');
        els.title.textContent = display.title;
        els.subtitle.textContent = display.subtitle;
        els.art.src = display.artwork;
        els.favorite.dataset.kind = state.kind || '';
        els.favorite.dataset.id = state.id || '';
        const appleUrl = state.liveMetadata?.purchase?.apple || '';
        const amazonUrl = state.liveMetadata?.purchase?.amazon || '';
        setStoreLink(els.buyApple, appleUrl);
        setStoreLink(els.buyAmazon, amazonUrl);
        if (els.store) {
            els.store.hidden = state.kind !== 'station' || isLofiStation() || (!appleUrl && !amazonUrl);
            if (els.store.hidden) closeStoreMenu();
        }
        mediaSession();
        try {
            sessionStorage.setItem('radiotedu_player', JSON.stringify({ kind: state.kind, id: state.id, src: state.src, title: state.title, subtitle: state.subtitle, artwork: state.artwork }));
        } catch (_) { /* storage may be disabled */ }
    };

    const stopStationMetadata = () => {
        window.clearInterval(state.metadataTimer);
        state.metadataTimer = null;
        state.metadataController?.abort();
        state.metadataController = null;
    };

    const refreshStationMetadata = async () => {
        if (document.hidden || state.kind !== 'station' || !state.id || isLofiStation()) return;
        const stationId = state.id;
        state.metadataController?.abort();
        const controller = new AbortController();
        state.metadataController = controller;
        try {
            const response = await fetch(`${config.restBase}stations/${encodeURIComponent(stationId)}/live?player=1`, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' },
            });
            const data = await apiData(response);
            if (state.kind !== 'station' || state.id !== stationId) return;
            const track = String(data.track || '').trim();
            const artist = String(data.artist || '').trim();
            state.liveMetadata = track ? {
                track,
                artist,
                artwork: String(data.artwork_url || '').trim(),
                startedAt: String(data.track_started_at || data.checked_at || '').trim(),
                purchase: {
                    apple: String(data.purchase?.apple || '').trim(),
                    amazon: String(data.purchase?.amazon || '').trim(),
                },
            } : null;
            updatePlayer();
            const trackKey = track ? `${artist}\n${track}` : '';
            if (!trackKey) {
                clearLyrics();
            } else if (trackKey !== state.lyricsTrackKey) {
                loadLyrics(track, artist, state.liveMetadata?.startedAt, trackKey);
            }
            if (trackKey && trackKey !== state.analyticsTrackKey) {
                state.analyticsTrackKey = trackKey;
                trackPlayerAnalytics('radio_track_change', {
                    artwork_available: Boolean(state.liveMetadata?.artwork),
                    store_links_available: Boolean(state.liveMetadata?.purchase?.apple || state.liveMetadata?.purchase?.amazon),
                });
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
        } finally {
            if (state.metadataController === controller) state.metadataController = null;
        }
    };

    const startStationMetadata = () => {
        stopStationMetadata();
        if (state.kind !== 'station' || isLofiStation()) return;
        refreshStationMetadata();
        state.metadataTimer = window.setInterval(refreshStationMetadata, 5_000);
    };

    const recordHistory = async (eventType = 'play') => {
        if (!state.session || !state.id || !state.kind) return;
        try {
            await accountFetch('profile/history', {
                method: 'POST',
                body: JSON.stringify({
                    kind: state.kind === 'podcast' ? 'podcast_episode' : 'station',
                    content_id: state.id,
                    title: state.title,
                    subtitle: state.subtitle,
                    event_type: eventType,
                    position_seconds: state.kind === 'podcast' ? Math.floor(audio.currentTime || 0) : null,
                    duration_seconds: state.kind === 'podcast' && Number.isFinite(audio.duration) ? Math.floor(audio.duration) : null,
                }),
            });
        } catch (_) { /* listening must not fail because history failed */ }
    };

    const saveProgress = async () => {
        if (!state.session || state.kind !== 'podcast' || !state.id || !Number.isFinite(audio.duration)) return;
        try {
            await accountFetch(`profile/progress/${encodeURIComponent(state.id)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    position_seconds: Math.floor(audio.currentTime),
                    duration_seconds: Math.floor(audio.duration),
                    completed: audio.duration > 0 && audio.currentTime / audio.duration >= 0.95,
                    title: state.title,
                    subtitle: state.subtitle,
                    artwork_url: state.artwork,
                }),
            });
        } catch (_) { /* playback remains independent */ }
    };

    const startProgressTimer = () => {
        window.clearInterval(state.progressTimer);
        state.progressTimer = window.setInterval(saveProgress, 15000);
    };

    const loadMedia = async (data, autoplay = true) => {
        if (!data.src) {
            showStatus(config.labels?.offline || 'YayÄ±n geÃ§ici olarak Ã§evrimdÄ±ÅŸÄ±');
            return;
        }
        const changed = state.src !== data.src;
        Object.assign(state, data);
        state.liveMetadata = null;
        clearLyrics();
        if (changed) {
            state.analyticsQuartiles = new Set();
            state.analyticsTrackKey = null;
        }
        if (changed) {
            audio.src = data.src;
            audio.load();
        }
        updatePlayer();
        startStationMetadata();
        if (autoplay) {
            try {
                await audio.play();
                recordHistory('play');
            } catch (_) {
                showStatus(config.labels?.error || 'Ses baÅŸlatÄ±lamadÄ±.');
            }
        }
    };

    els.toggle.addEventListener('click', async () => {
        if (!audio.src && state.src) audio.src = state.src;
        if (!audio.src) {
            const first = document.querySelector('[data-rt-play="station"]');
            if (first) first.click();
            return;
        }
        if (audio.paused) {
            try { await audio.play(); } catch (_) { showStatus(config.labels?.error || 'Ses baÅŸlatÄ±lamadÄ±.'); }
        } else {
            audio.pause();
        }
    });

    player.querySelectorAll('[data-rt-skip]').forEach((button) => button.addEventListener('click', () => {
        if (state.kind !== 'podcast') return;
        audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + Number(button.dataset.rtSkip || 0)));
    }));

    els.seek.addEventListener('input', () => {
        if (state.kind === 'podcast' && Number.isFinite(audio.duration)) audio.currentTime = (Number(els.seek.value) / 100) * audio.duration;
    });
    els.volume.value = localStorage.getItem('radiotedu_volume') || '0.8';
    audio.volume = Number(els.volume.value);
    els.volume.addEventListener('input', () => {
        audio.volume = Number(els.volume.value);
        localStorage.setItem('radiotedu_volume', String(audio.volume));
    });
    els.expand.addEventListener('click', () => {
        const expanded = document.body.classList.toggle('rt-player-expanded');
        els.expand.setAttribute('aria-expanded', String(expanded));
    });

    const verifiedChannelId = () => {
        const value = String(state.id || '').toLowerCase();
        if (value.includes('jazz') || value.includes('cazz')) return 'jazz';
        if (value.includes('lofi') || value.includes('lo-fi')) return 'lofi';
        if (value.includes('classic') || value.includes('klasik')) return 'classical';
        if (value.includes('ai')) return 'ai';
        return 'radio';
    };

    const stopVerifiedListening = () => {
        if (state.verifiedListeningTimer) window.clearInterval(state.verifiedListeningTimer);
        state.verifiedListeningTimer = null;
        state.verifiedListening = null;
    };

    const sendVerifiedListeningHeartbeat = async () => {
        const proof = state.verifiedListening;
        if (!proof || proof.inFlight || audio.paused || state.kind !== 'station') return;
        proof.inFlight = true;
        try {
            const data = await accountFetch('economy/listening/heartbeat', {
                method: 'POST',
                body: JSON.stringify({ session_id: proof.sessionId, nonce: proof.nonce, is_playing: true }),
            });
            proof.nonce = data.nonce;
            if (data.reward?.applied && state.session) {
                state.session.gold_balance = data.reward.spendablePoints;
                renderAccountHeader();
                showStatus(t(`+${data.reward.awarded} Gold Â· 60 dakika dinleme`, `+${data.reward.awarded} Gold Â· 60 minutes listening`));
            }
        } catch (_) {
            stopVerifiedListening();
        } finally {
            proof.inFlight = false;
        }
    };

    const startVerifiedListening = async () => {
        stopVerifiedListening();
        if (!state.session || state.kind !== 'station' || audio.paused) return;
        const clientSessionId = globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        try {
            const data = await accountFetch('economy/listening/start', {
                method: 'POST',
                body: JSON.stringify({ client_session_id: clientSessionId, channel_id: verifiedChannelId() }),
            });
            state.verifiedListening = { sessionId: data.session.id, nonce: data.nonce, inFlight: false };
            state.verifiedListeningTimer = window.setInterval(sendVerifiedListeningHeartbeat, 25_000);
        } catch (_) { /* playback continues without a reward session */ }
    };

    audio.addEventListener('play', () => {
        player.classList.add('is-playing');
        startProgressTimer();
        startVerifiedListening();
        trackPlayerAnalytics('playback_start', {
            position_seconds: Math.max(0, Math.floor(audio.currentTime || 0)),
            playback_mode: state.kind === 'podcast' ? 'on_demand' : 'live',
        });
    });
    audio.addEventListener('pause', () => {
        player.classList.remove('is-playing');
        trackPlayerAnalytics('playback_pause', { position_seconds: Math.max(0, Math.floor(audio.currentTime || 0)) });
        saveProgress();
        stopVerifiedListening();
    });
    audio.addEventListener('ended', () => {
        player.classList.remove('is-playing');
        trackPlayerAnalytics('playback_complete', {
            duration_seconds: Number.isFinite(audio.duration) ? Math.max(0, Math.floor(audio.duration)) : 0,
        });
        saveProgress();
        recordHistory('complete');
        stopVerifiedListening();
    });
    audio.addEventListener('error', () => {
        player.classList.remove('is-playing');
        trackPlayerAnalytics('playback_error', { media_error_code: Number(audio.error?.code || 0) });
        stopVerifiedListening();
        showStatus(config.labels?.offline || 'YayÄ±n geÃ§ici olarak Ã§evrimdÄ±ÅŸÄ±');
    });
    audio.addEventListener('loadedmetadata', () => { els.duration.textContent = formatTime(audio.duration); });
    audio.addEventListener('timeupdate', () => {
        els.current.textContent = formatTime(audio.currentTime);
        els.duration.textContent = formatTime(audio.duration);
        if (state.kind === 'podcast' && Number.isFinite(audio.duration) && audio.duration > 0) {
            const percent = (audio.currentTime / audio.duration) * 100;
            els.seek.value = String(percent);
            [25, 50, 75].forEach((quartile) => {
                if (percent >= quartile && !state.analyticsQuartiles.has(quartile)) {
                    state.analyticsQuartiles.add(quartile);
                    trackPlayerAnalytics('podcast_progress', {
                        progress_percent: quartile,
                        position_seconds: Math.max(0, Math.floor(audio.currentTime)),
                        duration_seconds: Math.max(0, Math.floor(audio.duration)),
                    });
                }
            });
        }
    });

    const favorite = async (kind, id, button) => {
        if (!state.session) {
            navigate(route('giris', 'login'));
            return;
        }
        const active = button.classList.contains('is-active');
        try {
            await accountFetch(`profile/favorites/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, {
                method: active ? 'DELETE' : 'PUT',
                body: active ? undefined : JSON.stringify({ title: state.id === id ? state.title : button.dataset.title || '', artwork_url: state.id === id ? state.artwork : button.dataset.artwork || '' }),
            });
            button.classList.toggle('is-active', !active);
            button.setAttribute('aria-pressed', String(!active));
            trackPlayerAnalytics('favorite_change', { favorite_action: active ? 'remove' : 'add' });
            showStatus(!active ? t('Favorilere eklendi', 'Added to favorites') : t('Favorilerden Ã§Ä±karÄ±ldÄ±', 'Removed from favorites'));
        } catch (error) {
            showStatus(error.message);
        }
    };

    document.addEventListener('click', (event) => {
        const storeToggle = event.target.closest('[data-rt-player-store-toggle]');
        if (storeToggle) {
            event.preventDefault();
            const open = els.storeMenu.hidden;
            els.storeMenu.hidden = !open;
            els.storeToggle.setAttribute('aria-expanded', String(open));
            if (open) els.storeMenu.querySelector('a:not([hidden])')?.focus({ preventScroll: true });
            return;
        }
        const storeLink = event.target.closest('[data-rt-buy-apple], [data-rt-buy-amazon]');
        if (storeLink) {
            trackPlayerAnalytics('track_store_click', {
                store_provider: storeLink.matches('[data-rt-buy-apple]') ? 'apple' : 'amazon',
            });
        }
        if (!event.target.closest('[data-rt-player-store]')) closeStoreMenu();
        const passwordToggle = event.target.closest('[data-rt-password-toggle]');
        if (passwordToggle) {
            event.preventDefault();
            const input = passwordToggle.parentElement?.querySelector('[data-rt-password-input]');
            if (!input) return;
            const reveal = input.type === 'password';
            input.type = reveal ? 'text' : 'password';
            passwordToggle.textContent = reveal ? t('Gizle', 'Hide') : t('GÃ¶ster', 'Show');
            passwordToggle.setAttribute('aria-label', reveal ? t('Åžifreyi gizle', 'Hide password') : t('Åžifreyi gÃ¶ster', 'Show password'));
            input.focus({ preventScroll: true });
            return;
        }
        const accountClose = event.target.closest('[data-rt-account-close]');
        if (accountClose) {
            event.preventDefault();
            closeAccountModal();
            return;
        }
        const accountTab = event.target.closest('[data-rt-account-mode]');
        if (accountTab) {
            event.preventDefault();
            renderAccountModal(accountTab.dataset.rtAccountMode);
            return;
        }
        const accountAnchor = event.target.closest('a[href]');
        const accountMode = accountModeFromLink(accountAnchor);
        if (accountMode && !state.session) {
            event.preventDefault();
            openAccountModal(accountMode, accountAnchor);
            return;
        }
        const play = event.target.closest('[data-rt-play]');
        if (play) {
            event.preventDefault();
            loadMedia({
                kind: play.dataset.rtPlay,
                id: play.dataset.id,
                src: play.dataset.src,
                title: play.dataset.title,
                subtitle: play.dataset.subtitle,
                artwork: play.dataset.artwork,
            });
            return;
        }
        const favoriteButton = event.target.closest('[data-rt-favorite]');
        if (favoriteButton) {
            event.preventDefault();
            favorite(favoriteButton.dataset.rtFavorite, favoriteButton.dataset.id, favoriteButton);
            return;
        }
        const searchToggle = event.target.closest('[data-rt-search-toggle]');
        if (searchToggle) {
            const drawer = document.querySelector('[data-rt-search-drawer]');
            const nav = document.querySelector('.rt-nav');
            nav?.classList.remove('is-open');
            document.querySelector('.rt-nav-toggle')?.setAttribute('aria-expanded', 'false');
            drawer.hidden = !drawer.hidden;
            if (!drawer.hidden) drawer.querySelector('input')?.focus();
            return;
        }
        const navToggle = event.target.closest('.rt-nav-toggle');
        if (navToggle) {
            const nav = document.querySelector('.rt-nav');
            const open = nav.classList.toggle('is-open');
            navToggle.setAttribute('aria-expanded', String(open));
            if (open) {
                const drawer = document.querySelector('[data-rt-search-drawer]');
                if (drawer) drawer.hidden = true;
            }
        }
    });
    document.addEventListener('keydown', (event) => {
        const modal = document.querySelector('[data-rt-account-modal]');
        if (event.key === 'Tab' && modal && !modal.hidden) {
            const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((node) => node.offsetParent !== null);
            if (focusable.length) {
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        }
        if (event.key === 'Escape' && els.storeMenu && !els.storeMenu.hidden) closeStoreMenu(true);
        if (event.key !== 'Escape') return;
        closeAccountModal();
        document.querySelector('.rt-nav')?.classList.remove('is-open');
        document.querySelector('.rt-nav-toggle')?.setAttribute('aria-expanded', 'false');
        const drawer = document.querySelector('[data-rt-search-drawer]');
        if (drawer) drawer.hidden = true;
    });
    els.favorite.addEventListener('click', () => {
        if (state.kind && state.id) favorite(state.kind === 'podcast' ? 'podcast_episode' : 'station', state.id, els.favorite);
    });

    const eligibleLink = (anchor, event) => {
        if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
        if (anchor.target || anchor.download || anchor.dataset.noPjax !== undefined) return false;
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin || url.pathname.startsWith('/wp-admin') || url.pathname.startsWith('/wp-login') || url.pathname.startsWith('/wp-json') || url.pathname.startsWith('/jukebox') || url.pathname.startsWith('/ai') || url.pathname.startsWith('/teknoloji') || url.pathname.startsWith('/bilet')) return false;
        if (url.pathname === location.pathname && url.search === location.search && url.hash) return false;
        return true;
    };

    const updateHead = (documentNext) => {
        document.title = documentNext.title;
        ['meta[name="description"]', 'link[rel="canonical"]'].forEach((selector) => {
            const current = document.head.querySelector(selector);
            const next = documentNext.head.querySelector(selector);
            if (current && next) current.replaceWith(next.cloneNode(true));
            else if (!current && next) document.head.append(next.cloneNode(true));
        });
        document.documentElement.lang = documentNext.documentElement.lang || document.documentElement.lang;
    };

    const afterRoute = () => {
        document.querySelector('.rt-nav')?.classList.remove('is-open');
        document.querySelector('.rt-nav-toggle')?.setAttribute('aria-expanded', 'false');
        initDynamicSections();
        const main = document.querySelector('[data-rt-page]');
        main?.focus({ preventScroll: true });
        document.dispatchEvent(new CustomEvent('radiotedu:routechange'));
        trackPlayerAnalytics('page_view', { page_title: document.title.slice(0, 120) });
    };

    async function navigate(target, push = true) {
        const url = new URL(target, location.href);
        state.navigationController?.abort();
        state.navigationController = new AbortController();
        els.progress?.classList.add('is-loading');
        document.documentElement.classList.add('rt-is-navigating');
        try {
            const response = await fetch(url.href, { signal: state.navigationController.signal, headers: { 'X-RadioTEDU-Navigation': '1' } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            const nextDocument = new DOMParser().parseFromString(html, 'text/html');
            const currentMain = document.querySelector('[data-rt-page]');
            const nextMain = nextDocument.querySelector('[data-rt-page]');
            if (!currentMain || !nextMain) throw new Error('Page shell missing');
            currentMain.replaceWith(nextMain);
            updateHead(nextDocument);
            if (push) history.pushState({ radiotedu: true }, '', url.href);
            window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            afterRoute();
        } catch (error) {
            if (error.name !== 'AbortError') location.href = url.href;
        } finally {
            els.progress?.classList.remove('is-loading');
            document.documentElement.classList.remove('rt-is-navigating');
        }
    }

    document.addEventListener('click', (event) => {
        const anchor = event.target.closest('a[href]');
        if (!eligibleLink(anchor, event)) return;
        event.preventDefault();
        navigate(anchor.href);
    });
    window.addEventListener('popstate', () => navigate(location.href, false));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshStationMetadata();
    });

    const liveSections = async () => {
        const nodes = [...document.querySelectorAll('[data-rt-live-status]')];
        await Promise.all(nodes.map(async (node) => {
            try {
                const response = await fetch(`${config.restBase}stations/${encodeURIComponent(node.dataset.rtLiveStatus)}/live`);
                const data = await apiData(response);
                node.querySelector('strong').textContent = data.track || (data.online ? t('CanlÄ± yayÄ±n', 'Live radio') : (config.labels?.offline || t('YayÄ±n geÃ§ici olarak Ã§evrimdÄ±ÅŸÄ±', 'Broadcast temporarily offline')));
                node.querySelector('small').textContent = data.artist || data.title || 'RadioTEDU';
            } catch (_) { /* default server-rendered state remains */ }
        }));
    };

    const trackHistory = async () => {
        const nodes = [...document.querySelectorAll('[data-rt-track-history]')];
        await Promise.all(nodes.map(async (node) => {
            try {
                const response = await fetch(`${config.restBase}stations/${encodeURIComponent(node.dataset.rtTrackHistory)}/history`);
                const items = await apiData(response);
                if (!Array.isArray(items) || !items.length) return;
                node.innerHTML = items.slice(0, 12).map((item) => `<article><time>${String(item.played_at || item.created_at || '').slice(11, 16)}</time><strong>${escapeHtml(item.title || item.track || '')}</strong><span>${escapeHtml(item.artist || '')}</span></article>`).join('');
            } catch (_) { /* default empty state remains */ }
        }));
    };

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

    const renderAccountHeader = () => {
        document.querySelectorAll('[data-rt-account-link]').forEach((link) => {
            const name = link.querySelector('[data-rt-account-name]');
            const gold = link.querySelector('[data-rt-account-gold]');
            const goldValue = link.querySelector('[data-rt-account-gold-value]');
            if (name) name.textContent = state.session
                ? (state.session.display_name || state.session.email || t('Profil', 'Profile'))
                : t('GiriÅŸ yap', 'Log in');
            if (gold) gold.hidden = !state.session;
            if (goldValue) goldValue.textContent = String(Math.max(0, Number(state.session?.gold_balance || 0)));
            link.href = state.session ? route('profilim', 'profile') : route('giris', 'login');
            link.setAttribute('aria-label', state.session
                ? `${name?.textContent || t('Profil', 'Profile')}, ${goldValue?.textContent || 0} Gold`
                : t('GiriÅŸ yap', 'Log in'));
        });
    };

    const accountModeFromLink = (anchor) => {
        if (!anchor) return null;
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin) return null;
        const slug = url.pathname.replace(/\/+$/, '').split('/').pop();
        if (slug === 'giris' || slug === 'login') return 'giris';
        if (slug === 'kayit' || slug === 'register') return 'kayit';
        return null;
    };

    const authMessage = (text = '') => `<p class="rt-form__message" role="status" aria-live="polite">${escapeHtml(text)}</p>`;
    const authMarkup = (mode) => mode === 'kayit'
        ? `<section class="rt-auth-card"><div class="rt-auth-card__intro"><h3>${t('HesabÄ±nÄ± oluÅŸtur', 'Create your account')}</h3><p>${t('Favorilerin ve dinleme geÃ§miÅŸin her cihazda seninle olsun.', 'Keep your favourites and listening history across devices.')}</p></div><form class="rt-form" data-rt-auth="register"><label><span>${t('GÃ¶rÃ¼nen ad', 'Display name')}</span><span class="rt-field"><input type="text" name="display_name" autocomplete="name" required maxlength="60"></span></label><label><span>${t('E-posta adresi', 'Email address')}</span><span class="rt-field"><input type="email" name="email" autocomplete="email" inputmode="email" required data-rt-registration-email></span></label><label class="rt-registration-age" data-rt-registration-age hidden><span>${t('YaÅŸÄ±nÄ±z', 'Your age')}</span><span class="rt-field"><input type="number" name="age" min="18" max="120" step="1" inputmode="numeric" disabled></span><small class="rt-form__age-note">${t('TEDU dÄ±ÅŸÄ±ndaki e-posta adresleriyle kayÄ±t iÃ§in 18 yaÅŸÄ±nda veya daha bÃ¼yÃ¼k olmalÄ±sÄ±nÄ±z.', 'You must be 18 or older to register with a non-TEDU email address.')}</small></label><label><span>${t('Åžifre', 'Password')}</span><span class="rt-field"><input type="password" name="password" autocomplete="new-password" required minlength="8" data-rt-password-input><button class="rt-password-toggle" type="button" data-rt-password-toggle aria-label="${t('Åžifreyi gÃ¶ster', 'Show password')}">${t('GÃ¶ster', 'Show')}</button></span></label><small class="rt-form__hint">${t('En az 8 karakter kullan.', 'Use at least 8 characters.')}</small><label class="rt-form__legal"><input type="checkbox" name="legal_acknowledgement" required><span>${t('', 'I accept the ')}<a href="${route('kullanim-kosullari', 'terms')}" target="_blank" rel="noopener">${t('KullanÄ±m KoÅŸullarÄ±â€™nÄ±', 'Terms of Use')}</a>${t(' kabul ediyor ve ', ' and acknowledge that I have read the ')}<a href="${route('gizlilik-politikasi', 'privacy')}" target="_blank" rel="noopener">${t('Gizlilik PolitikasÄ±â€™nÄ±', 'Privacy Notice')}</a>${t(' okuduÄŸumu onaylÄ±yorum.', '.')}</span></label><input type="hidden" name="terms_version" value="2026-08-11"><input type="hidden" name="privacy_version" value="2026-08-11">${authMessage()}<button class="rt-button rt-button--primary" type="submit"><span>${t('Hesap oluÅŸtur', 'Create account')}</span><i aria-hidden="true">â†’</i></button></form><p class="rt-auth-card__switch">${t('Zaten hesabÄ±n var mÄ±?', 'Already have an account?')} <a data-rt-account-switch href="${route('giris', 'login')}">${t('GiriÅŸ yap', 'Sign in')}</a></p></section>`
        : `<section class="rt-auth-card"><div class="rt-auth-card__intro"><h3>${t('HesabÄ±nla devam et', 'Continue with your account')}</h3><p>${t('Favorilerine ve kaldÄ±ÄŸÄ±n bÃ¶lÃ¼mlere yeniden ulaÅŸ.', 'Return to your favourites and unfinished episodes.')}</p></div><form class="rt-form" data-rt-auth="login"><label><span>${t('E-posta adresi', 'Email address')}</span><span class="rt-field"><input type="email" name="email" autocomplete="email" inputmode="email" required></span></label><label><span>${t('Åžifre', 'Password')}</span><span class="rt-field"><input type="password" name="password" autocomplete="current-password" required minlength="8" data-rt-password-input><button class="rt-password-toggle" type="button" data-rt-password-toggle aria-label="${t('Åžifreyi gÃ¶ster', 'Show password')}">${t('GÃ¶ster', 'Show')}</button></span></label><p class="rt-form__legal-note">${t('Devam ederek ', 'By continuing, you accept the ')}<a href="${route('kullanim-kosullari', 'terms')}" target="_blank" rel="noopener">${t('KullanÄ±m KoÅŸullarÄ±â€™nÄ±', 'Terms of Use')}</a>${t(' kabul eder ve ', ' and acknowledge that you have read the ')}<a href="${route('gizlilik-politikasi', 'privacy')}" target="_blank" rel="noopener">${t('Gizlilik PolitikasÄ±â€™nÄ±', 'Privacy Notice')}</a>${t(' okuduÄŸunuzu onaylarsÄ±nÄ±z.', '.')}</p>${authMessage()}<button class="rt-button rt-button--primary" type="submit"><span>${t('GiriÅŸ yap', 'Sign in')}</span><i aria-hidden="true">â†’</i></button></form><div class="rt-auth-divider"><span>${t('ekip giriÅŸi', 'team sign-in')}</span></div><button class="rt-button rt-button--ghost" type="button" data-rt-erp-login><span class="rt-erp-mark" aria-hidden="true">R</span><span>${t('RadioTEDU ekibinden misin?', 'Are you on the RadioTEDU team?')}</span></button><p class="rt-auth-card__switch">${t('HesabÄ±n yok mu?', 'New here?')} <a data-rt-account-switch href="${route('kayit', 'register')}">${t('KayÄ±t ol', 'Create account')}</a></p></section>`;

    const isTeduEmailAddress = (email) => {
        const domain = String(email || '').trim().toLowerCase().split('@').pop() || '';
        return domain === 'tedu.edu.tr' || domain.endsWith('.tedu.edu.tr');
    };

    const bindRegistrationPolicy = (root) => {
        root.querySelectorAll('[data-rt-auth="register"]').forEach((form) => {
            const email = form.querySelector('[data-rt-registration-email]');
            const ageGroup = form.querySelector('[data-rt-registration-age]');
            const age = ageGroup?.querySelector('input[name="age"]');
            if (!email || !ageGroup || !age) return;
            const sync = () => {
                const address = email.value.trim();
                const requiresAge = address.includes('@') && !isTeduEmailAddress(address);
                ageGroup.hidden = !requiresAge;
                age.disabled = !requiresAge;
                age.required = requiresAge;
                if (!requiresAge) age.value = '';
            };
            email.addEventListener('input', sync);
            email.addEventListener('change', sync);
            sync();
        });
    };

    const session = async () => {
        try {
            const data = await accountFetch('auth/web/session');
            state.session = data.user || data;
            state.csrf = data.csrf_token || null;
        } catch (_) {
            state.session = null;
            state.csrf = null;
        }
        renderAccountHeader();
        if (state.session && state.kind === 'station' && !audio.paused && !state.verifiedListening) {
            queueMicrotask(() => startVerifiedListening());
        }
        return state.session;
    };

    const closeAccountModal = () => {
        const modal = document.querySelector('[data-rt-account-modal]');
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('rt-account-modal-open');
        const trigger = state.accountModalTrigger;
        state.accountModalTrigger = null;
        trigger?.focus({ preventScroll: true });
    };

    const cleanAccountCallbackUrl = () => {
        const url = new URL(location.href);
        url.searchParams.delete('erp_code');
        url.searchParams.delete('erp_status');
        url.searchParams.delete('hesap');
        url.searchParams.delete('account_popup');
        history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    };

    const completeErpPopup = () => {
        if (window.name !== 'radiotedu-tedu-login') return false;
        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel('radiotedu-account-auth');
            channel.postMessage({ type: 'radiotedu:erp-login-complete' });
            channel.close();
        }
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'radiotedu:erp-login-complete' }, location.origin);
        }
        window.close();
        return true;
    };

    const completeAccountLoginPopup = () => {
        if (window.name !== 'radiotedu-account-login') return false;
        const message = { type: 'radiotedu:account-login-complete' };
        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel('radiotedu-account-auth');
            channel.postMessage(message);
            channel.close();
        }
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage(message, location.origin);
        }
        window.close();
        return true;
    };

    const handleErpLoginComplete = async () => {
        state.erpPopup = null;
        await session();
        if (!state.session) {
            showStatus(t('RadioTEDU ekip oturumu henÃ¼z doÄŸrulanamadÄ±.', 'The RadioTEDU team session could not be verified yet.'));
            return;
        }
        closeAccountModal();
        showStatus(t('RadioTEDU ekip hesabÄ±yla giriÅŸ yapÄ±ldÄ±.', 'Signed in with your RadioTEDU team account.'));
        if (completeAccountLoginPopup()) return;
        const target = accountReturnTo();
        if (target) location.assign(target);
    };

    window.addEventListener('message', async (event) => {
        if (event.origin !== location.origin || event.data?.type !== 'radiotedu:erp-login-complete') return;
        await handleErpLoginComplete();
    });
    if ('BroadcastChannel' in window) {
        const erpAuthChannel = new BroadcastChannel('radiotedu-account-auth');
        erpAuthChannel.addEventListener('message', (event) => {
            if (event.data?.type === 'radiotedu:erp-login-complete') handleErpLoginComplete();
        });
    }

    const accountReturnTo = () => {
        const requested = new URLSearchParams(location.search).get('return_to');
        if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return null;
        try {
            const target = new URL(requested, location.origin);
            if (target.origin !== location.origin) return null;
            return `${target.pathname}${target.search}${target.hash}`;
        } catch (_) {
            return null;
        }
    };

    const continueToAccountReturn = () => {
        const target = accountReturnTo();
        if (!target) return false;
        location.assign(target);
        return true;
    };

    const renderAccountModal = async (mode = 'giris') => {
        const modal = document.querySelector('[data-rt-account-modal]');
        const root = modal?.querySelector('[data-rt-account-modal-app]');
        if (!modal || !root) return;
        const selectedMode = mode === 'kayit' ? 'kayit' : 'giris';
        const dialogTitle = modal.querySelector('#rt-account-modal-title');
        if (dialogTitle) dialogTitle.textContent = selectedMode === 'kayit' ? t('AramÄ±za katÄ±l.', 'Join RadioTEDU.') : t('Tekrar hoÅŸ geldin.', 'Welcome back.');
        modal.querySelectorAll('[data-rt-account-mode]').forEach((tab) => {
            const active = tab.dataset.rtAccountMode === selectedMode;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
        });
        root.innerHTML = authMarkup(selectedMode);
        bindRegistrationPolicy(root);

        const params = new URLSearchParams(location.search);
        if (params.get('erp_code')) {
            const message = root.querySelector('.rt-form__message');
            if (message) message.textContent = t('RadioTEDU ekip hesabÄ±n doÄŸrulanÄ±yorâ€¦', 'Verifying your RadioTEDU team accountâ€¦');
            try {
                await accountFetch('auth/web/erp-exchange', { method: 'POST', body: JSON.stringify({ code: params.get('erp_code') }) });
                cleanAccountCallbackUrl();
                await session();
                if (completeErpPopup()) return;
                if (continueToAccountReturn()) return;
                closeAccountModal();
                showStatus(t('GiriÅŸ yapÄ±ldÄ±.', 'Signed in.'));
            } catch (error) {
                if (message) message.textContent = error.message;
            }
            return;
        }

        await session();
        if (state.session) {
            if (completeErpPopup()) return;
            if (completeAccountLoginPopup()) return;
            if (continueToAccountReturn()) return;
            root.innerHTML = `<section class="rt-auth-card"><h2>${t('GiriÅŸ yaptÄ±n', 'You are signed in')}</h2><p>${escapeHtml(state.session.display_name || state.session.email)}</p><a class="rt-button rt-button--primary" href="${route('profilim', 'profile')}">${t('Profilime git', 'Go to my profile')}</a></section>`;
        }
    };

    const openAccountModal = (mode = 'giris', trigger = null) => {
        const modal = document.querySelector('[data-rt-account-modal]');
        if (!modal) return;
        state.accountModalTrigger = trigger || document.activeElement;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('rt-account-modal-open');
        document.querySelector('.rt-nav')?.classList.remove('is-open');
        document.querySelector('.rt-nav-toggle')?.setAttribute('aria-expanded', 'false');
        const drawer = document.querySelector('[data-rt-search-drawer]');
        if (drawer) drawer.hidden = true;
        renderAccountModal(mode).then(() => {
            const target = modal.querySelector('input:not([disabled]), .rt-account-modal__panel');
            target?.focus({ preventScroll: true });
        });
    };

    const renderAccountPage = async () => {
        const root = document.querySelector('[data-rt-account-page]');
        if (!root) return;
        const page = root.dataset.rtAccountPage;
        await session();
        if (state.session && completeErpPopup()) return;

        if ((page === 'giris' || page === 'kayit') && state.session && continueToAccountReturn()) return;

        if (page === 'giris' && !state.session) {
            root.innerHTML = authMarkup('giris');
        } else if (page === 'kayit' && !state.session) {
            root.innerHTML = authMarkup('kayit');
        } else if ((page === 'giris' || page === 'kayit') && state.session) {
            root.innerHTML = `<section class="rt-auth-card"><h2>${t('GiriÅŸ yaptÄ±n', 'You are signed in')}</h2><p>${escapeHtml(state.session.display_name || state.session.email)}</p><a class="rt-button rt-button--primary" href="${route('profilim', 'profile')}">${t('Profilime git', 'Go to my profile')}</a></section>`;
        } else if (!state.session) {
            root.innerHTML = `<section class="rt-auth-card"><h2>${t('Bu alan hesabÄ±na baÄŸlÄ±', 'This area belongs to your account')}</h2><p>${t('Favorilerini ve dinleme geÃ§miÅŸini gÃ¶rmek iÃ§in giriÅŸ yap.', 'Sign in to see your favorites and listening history.')}</p><a class="rt-button rt-button--primary" href="${route('giris', 'login')}">${t('GiriÅŸ yap', 'Sign in')}</a></section>`;
        } else if (page === 'profilim') {
            try {
                const profileData = await accountFetch('profile/me');
                state.profile = profileData.profile || {};
            } catch (_) {
                state.profile = {};
            }
            root.innerHTML = `<section class="rt-auth-card"><p class="rt-kicker">${t('HesabÄ±m', 'My account')}</p><h2>${escapeHtml(state.session.display_name || t('RadioTEDU dinleyicisi', 'RadioTEDU listener'))}</h2><p>${escapeHtml(state.session.email || '')}</p><p class="rt-account-gold-summary"><strong>${Math.max(0, Number(state.session.gold_balance || 0))} Gold</strong> Â· ${t('TÃ¼m RadioTEDU deneyimlerinde ortak bakiyen', 'Your shared balance across RadioTEDU')}</p><form class="rt-form" data-rt-profile><label><span>${t('BÃ¶lÃ¼m / birim', 'Department / unit')}</span><span class="rt-field"><input type="text" name="department" maxlength="160" autocomplete="organization-title" value="${escapeHtml(state.profile.department || '')}" required></span></label><small class="rt-form__hint">${state.profile.profile_completed_at ? t('Profil tamamlama Ã¶dÃ¼lÃ¼n daha Ã¶nce iÅŸlendi.', 'Your profile completion reward has already been granted.') : t('Profilini ilk kez tamamladÄ±ÄŸÄ±nda +40 Gold kazanÄ±rsÄ±n.', 'Earn +40 Gold when you complete your profile for the first time.')}</small>${authMessage()}<button class="rt-button rt-button--primary" type="submit"><span>${t('Profili kaydet', 'Save profile')}</span><i aria-hidden="true">â†’</i></button></form><div class="rt-hero__actions"><a class="rt-button rt-button--ghost" href="${route('favorilerim', 'favorites')}">${t('Favorilerim', 'Favorites')}</a><a class="rt-button rt-button--ghost" href="${route('dinleme-gecmisim', 'listening-history')}">${t('Dinleme geÃ§miÅŸim', 'Listening history')}</a><button class="rt-button rt-button--primary" type="button" data-rt-logout>${t('Ã‡Ä±kÄ±ÅŸ yap', 'Sign out')}</button></div></section>`;
        } else {
            try {
                const endpoint = page === 'favorilerim' ? 'profile/library' : 'profile/history?limit=100';
                const data = await accountFetch(endpoint);
                const items = page === 'favorilerim' ? (data.favorites || []) : (data.items || data.history || []);
                root.innerHTML = `<section class="rt-library"><h2>${page === 'favorilerim' ? t('Favorilerim', 'Favorites') : t('Dinleme geÃ§miÅŸim', 'Listening history')}</h2><div class="rt-library__list">${items.length ? items.map((item) => `<article class="rt-library__item"><div><strong>${escapeHtml(item.title || item.content_id)}</strong><small>${escapeHtml(item.subtitle || item.kind || '')}</small></div><span>${item.position_seconds ? formatTime(item.position_seconds) : ''}</span></article>`).join('') : `<div class="rt-empty"><p>${t('HenÃ¼z burada bir iÃ§erik yok.', 'Nothing here yet.')}</p></div>`}</div>${page === 'dinleme-gecmisim' && items.length ? `<button class="rt-button rt-button--ghost" type="button" data-rt-clear-history>${t('GeÃ§miÅŸi temizle', 'Clear history')}</button>` : ''}</section>`;
            } catch (error) {
                root.innerHTML = `<div class="rt-empty"><p>${escapeHtml(error.message)}</p></div>`;
            }
        }

        bindRegistrationPolicy(root);

        const params = new URLSearchParams(location.search);
        if (params.get('erp_code') && page === 'giris') {
            try {
                await accountFetch('auth/web/erp-exchange', { method: 'POST', body: JSON.stringify({ code: params.get('erp_code') }) });
                await session();
                if (completeErpPopup()) return;
                if (continueToAccountReturn()) return;
                history.replaceState(history.state, '', location.pathname);
                await renderAccountPage();
            } catch (error) { root.querySelector('.rt-form__message')?.replaceChildren(error.message); }
        }
    };

    document.addEventListener('submit', async (event) => {
        const profileForm = event.target.closest('[data-rt-profile]');
        if (profileForm) {
            event.preventDefault();
            const target = profileForm.querySelector('.rt-form__message');
            const submit = profileForm.querySelector('button[type="submit"]');
            const fields = ['favorite_song_title', 'favorite_song_artist', 'favorite_song_spotify_uri', 'favorite_artist_name', 'favorite_artist_spotify_id', 'favorite_podcast_id', 'favorite_podcast_title', 'profile_headline', 'featured_badge_id', 'theme_key'];
            const payload = Object.fromEntries(fields.map((key) => [key, state.profile?.[key] ?? null]));
            payload.department = new FormData(profileForm).get('department');
            profileForm.setAttribute('aria-busy', 'true');
            if (submit) submit.disabled = true;
            target.textContent = t('Kaydediliyorâ€¦', 'Savingâ€¦');
            try {
                const data = await accountFetch('profile/me', { method: 'PUT', body: JSON.stringify(payload) });
                state.profile = data.profile || state.profile;
                if (data.profile_completion_reward?.spendablePoints != null) {
                    state.session.gold_balance = data.profile_completion_reward.spendablePoints;
                    renderAccountHeader();
                }
                target.textContent = data.profile_completion_reward?.applied
                    ? t(`Profil tamamlandÄ±: +${data.profile_completion_reward.awarded} Gold`, `Profile completed: +${data.profile_completion_reward.awarded} Gold`)
                    : t('Profilin kaydedildi.', 'Your profile was saved.');
            } catch (error) {
                target.textContent = error.message;
            } finally {
                profileForm.removeAttribute('aria-busy');
                if (submit) submit.disabled = false;
            }
            return;
        }
        const form = event.target.closest('[data-rt-auth]');
        if (!form) return;
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        if (form.dataset.rtAuth === 'register') {
            const legalAcknowledged = values.legal_acknowledgement === 'on';
            values.terms_accepted = legalAcknowledged;
            values.privacy_acknowledged = legalAcknowledged;
            delete values.legal_acknowledgement;
            if (values.age) values.age = Number(values.age);
            else delete values.age;
        }
        const target = form.querySelector('.rt-form__message');
        const submit = form.querySelector('button[type="submit"]');
        const submitLabel = submit?.querySelector('span')?.textContent || submit?.textContent || '';
        form.setAttribute('aria-busy', 'true');
        if (submit) {
            submit.disabled = true;
            const label = submit.querySelector('span');
            if (label) label.textContent = t('Ä°ÅŸleniyorâ€¦', 'Workingâ€¦');
        }
        target.textContent = t('Ä°ÅŸleniyorâ€¦', 'Workingâ€¦');
        try {
            await accountFetch(`auth/web/${form.dataset.rtAuth}`, { method: 'POST', body: JSON.stringify(values) });
            await session();
            if (completeErpPopup()) return;
            if (completeAccountLoginPopup()) return;
            if (continueToAccountReturn()) return;
            if (form.closest('[data-rt-account-modal]')) {
                closeAccountModal();
                showStatus(form.dataset.rtAuth === 'register' ? t('HesabÄ±n hazÄ±r.', 'Your account is ready.') : t('GiriÅŸ yapÄ±ldÄ±.', 'Signed in.'));
            } else {
                await navigate(route('profilim', 'profile'));
            }
        } catch (error) {
            target.textContent = error.message;
        } finally {
            form.removeAttribute('aria-busy');
            if (submit) {
                submit.disabled = false;
                const label = submit.querySelector('span');
                if (label) label.textContent = submitLabel;
            }
        }
    });
    document.addEventListener('click', async (event) => {
        if (event.target.closest('[data-rt-erp-login]')) {
            const button = event.target.closest('[data-rt-erp-login]');
            button.disabled = true;
            try {
                const returnUrl = new URL(route('giris', 'login'), location.origin);
                const data = await accountFetch('auth/erp-link/login/start', { method: 'POST', body: JSON.stringify({ return_uri: returnUrl.href }) });
                const authorizeUrl = data.authorization_url || data.authorize_url;
                if (!authorizeUrl) throw new Error(t('ERP giriÅŸ adresi alÄ±namadÄ±.', 'The ERP sign-in address could not be retrieved.'));
                location.assign(authorizeUrl);
            } catch (error) {
                button.disabled = false;
                const message = button.closest('.rt-auth-card')?.querySelector('.rt-form__message');
                if (message) message.textContent = error.message;
                else showStatus(error.message);
            }
        }
        if (event.target.closest('[data-rt-logout]')) {
            await accountFetch('auth/web/logout', { method: 'POST', body: '{}' }).catch(() => {});
            state.session = null;
            await navigate(config.homeUrl || '/');
        }
        if (event.target.closest('[data-rt-clear-history]')) {
            await accountFetch('profile/history', { method: 'DELETE', body: '{}' });
            await renderAccountPage();
        }
    });

    const restartHeroTicker = () => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        document.querySelectorAll('.rt-hero__ticker-track').forEach((track) => {
            track.style.animation = 'none';
            void track.offsetWidth;
            track.style.animation = '';
        });
    };

    const initDynamicSections = () => {
        liveSections();
        trackHistory();
        renderAccountPage();
        restartHeroTicker();
    };

    if (document.fonts?.ready) document.fonts.ready.then(restartHeroTicker).catch(() => {});
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) restartHeroTicker();
    });
    window.addEventListener('pageshow', restartHeroTicker);

    try {
        const saved = JSON.parse(sessionStorage.getItem('radiotedu_player') || 'null');
        if (saved?.src) loadMedia(saved, false);
    } catch (_) { /* ignore invalid session state */ }
    session();
    initDynamicSections();
    const initialAccountParams = new URLSearchParams(location.search);
    if (initialAccountParams.get('erp_code') || ['giris', 'kayit'].includes(initialAccountParams.get('hesap'))) {
        openAccountModal(initialAccountParams.get('hesap') || 'giris');
    }
})();

(() => {
    'use strict';

    const config = window.RadioTEDUConfig || {};
    const root = document.querySelector('[data-rt-cookie-consent]');
    if (!root) return;

    const isEnglish = config.language === 'en';
    const cookieName = config.consentCookieName || 'rt_cookie_consent_v1';
    const measurementId = /^G-[A-Z0-9]+$/.test(config.analyticsMeasurementId || '')
        ? config.analyticsMeasurementId
        : '';
    const banner = root.querySelector('[data-rt-cookie-banner]');
    const overlay = root.querySelector('[data-rt-cookie-overlay]');
    const panel = root.querySelector('[data-rt-cookie-panel]');
    const analyticsInput = root.querySelector('[data-rt-cookie-analytics]');
    const matchingInput = root.querySelector('[data-rt-cookie-matching]');
    const status = root.querySelector('[data-rt-cookie-status]');
    let returnFocus = null;

    const message = (turkish, english) => isEnglish ? english : turkish;

    const readConsent = () => {
        const prefix = `${cookieName}=`;
        const row = document.cookie.split('; ').find((item) => item.startsWith(prefix));
        if (!row) return { decided: false, analytics: false, matching: false };
        const value = decodeURIComponent(row.slice(prefix.length));
        const match = /^a([01])m([01])\.(\d{10,})$/.exec(value);
        if (!match) return { decided: false, analytics: false, matching: false };
        const analytics = match[1] === '1';
        return { decided: true, analytics, matching: analytics && match[2] === '1' };
    };

    const setConsentCookie = (analytics, matching) => {
        const value = `a${analytics ? 1 : 0}m${matching && analytics ? 1 : 0}.${Date.now()}`;
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${cookieName}=${encodeURIComponent(value)}; Path=/; Max-Age=15552000; SameSite=Lax${secure}`;
    };

    const updateConsentMode = ({ analytics, matching }) => {
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
        window.gtag('consent', 'update', {
            analytics_storage: analytics ? 'granted' : 'denied',
            ad_storage: 'denied',
            ad_user_data: analytics && matching ? 'granted' : 'denied',
            ad_personalization: 'denied',
            personalization_storage: 'denied',
            functionality_storage: 'granted',
            security_storage: 'granted'
        });
    };

    const loadAnalytics = () => {
        if (!measurementId || document.querySelector('[data-rt-analytics-script]')) return;
        updateConsentMode(readConsent());
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        script.dataset.rtAnalyticsScript = 'true';
        document.head.appendChild(script);
        window.gtag('js', new Date());
        window.gtag('config', measurementId, {
            allow_google_signals: false,
            allow_ad_personalization_signals: false
        });
    };

    const clearAnalyticsCookies = () => {
        const names = document.cookie.split(';').map((item) => item.split('=')[0].trim()).filter((name) => name === '_ga' || name.startsWith('_ga_'));
        const domains = ['', location.hostname, '.radiotedu.com'];
        names.forEach((name) => {
            domains.forEach((domain) => {
                const domainPart = domain ? `; Domain=${domain}` : '';
                document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${domainPart}`;
            });
        });
    };

    const syncInputs = () => {
        const consent = readConsent();
        analyticsInput.checked = consent.analytics;
        matchingInput.checked = consent.matching;
    };

    const focusable = () => [...panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hidden && element.getClientRects().length);

    const closePreferences = () => {
        overlay.hidden = true;
        document.body.classList.remove('rt-cookie-panel-open');
        if (!readConsent().decided) banner.hidden = false;
        if (returnFocus instanceof HTMLElement) returnFocus.focus();
        returnFocus = null;
    };

    const openPreferences = (trigger) => {
        returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
        syncInputs();
        banner.hidden = true;
        overlay.hidden = false;
        document.body.classList.add('rt-cookie-panel-open');
        panel.focus();
    };

    const persist = (analytics, matching) => {
        const previous = readConsent();
        const next = { decided: true, analytics: Boolean(analytics), matching: Boolean(analytics && matching) };
        setConsentCookie(next.analytics, next.matching);
        updateConsentMode(next);
        if (next.analytics) {
            loadAnalytics();
        } else {
            clearAnalyticsCookies();
        }
        status.textContent = message('Ã‡erez tercihin kaydedildi.', 'Your cookie preference has been saved.');
        banner.hidden = true;
        overlay.hidden = true;
        document.body.classList.remove('rt-cookie-panel-open');
        if (previous.analytics && !next.analytics) {
            location.reload();
            return;
        }
        if (returnFocus instanceof HTMLElement) returnFocus.focus();
        returnFocus = null;
    };

    root.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('[data-rt-cookie-accept]')) {
            persist(true, true);
        } else if (target.closest('[data-rt-cookie-reject]')) {
            persist(false, false);
        } else if (target.closest('[data-rt-cookie-save]')) {
            persist(analyticsInput.checked, matchingInput.checked);
        } else if (target.closest('[data-rt-cookie-preferences]')) {
            openPreferences(target.closest('button'));
        } else if (target.closest('[data-rt-cookie-close]') || target === overlay) {
            closePreferences();
        }
    });

    document.addEventListener('click', (event) => {
        const trigger = event.target instanceof Element ? event.target.closest('[data-rt-cookie-open]') : null;
        if (trigger) openPreferences(trigger);
    });

    analyticsInput.addEventListener('change', () => {
        if (!analyticsInput.checked) matchingInput.checked = false;
    });
    matchingInput.addEventListener('change', () => {
        if (matchingInput.checked) analyticsInput.checked = true;
    });

    panel.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closePreferences();
            return;
        }
        if (event.key !== 'Tab') return;
        const items = focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    const consent = readConsent();
    updateConsentMode(consent);
    if (consent.analytics) loadAnalytics();
    if (!consent.decided) banner.hidden = false;
})();
