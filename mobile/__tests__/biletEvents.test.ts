import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  parseBiletDates,
  parseBiletHtml,
  fetchEvents,
  AppEvent,
} from '../src/services/gamificationService';
import api from '../src/services/api';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const SAMPLE_BILET_HTML = `
<!DOCTYPE html>
<html>
<body>
  <div class="rtb-events-grid">
    <a class="rtb-event" href="https://radiotedu.com/bilet/event.php?slug=hello-campus-party">
      <div class="rtb-event__image">
        <img src="uploads/event_1788562045.png" alt="Hello Campus Party">
        <span class="rtb-event__category">Parti</span>
      </div>
      <div class="rtb-event__body">
        <div class="rtb-event__date">
          <strong>01</strong>
          <span>Ekim 2026</span>
        </div>
        <div class="rtb-event__details">
          <h3>Hello Campus Party</h3>
          <p class="rtb-event__meta">
            <span>Le Porte Roof</span>
            <span>20:00–23:59</span>
          </p>
          <span class="rtb-event__price">800 ₺</span>
        </div>
      </div>
    </a>
  </div>
</body>
</html>
`;

describe('bilet events auto-sync and date expiration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('parses bilet dates into accurate ISO strings with Istanbul timezone', () => {
    const {startsAt, endsAt} = parseBiletDates('01', 'Ekim 2026', '20:00–23:59');
    expect(startsAt).toBe('2026-10-01T20:00:00+03:00');
    expect(endsAt).toBe('2026-10-01T23:59:00+03:00');

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    expect(Number.isFinite(startDate.getTime())).toBe(true);
    expect(Number.isFinite(endDate.getTime())).toBe(true);
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
  });

  it('parses bilet HTML into structured AppEvent objects with ticket URLs', () => {
    const events = parseBiletHtml(SAMPLE_BILET_HTML);
    expect(events.length).toBe(1);

    const event = events[0];
    expect(event.id).toBe('bilet-hello-campus-party');
    expect(event.title).toBe('Hello Campus Party');
    expect(event.location).toBe('Le Porte Roof');
    expect(event.price).toBe('800 ₺');
    expect(event.category).toBe('Parti');
    expect(event.image_url).toBe('https://radiotedu.com/bilet/uploads/event_1788562045.png');
    expect(event.ticket_url).toBe('https://radiotedu.com/bilet/event.php?slug=hello-campus-party');
    expect(event.starts_at).toBe('2026-10-01T20:00:00+03:00');
    expect(event.ends_at).toBe('2026-10-01T23:59:00+03:00');
  });

  it('automatically keeps the event visible prior to expiration and filters it out on October 2nd', async () => {
    const parsedEvents = parseBiletHtml(SAMPLE_BILET_HTML);

    // Mock API returning empty, forcing direct bilet fetch
    (api.get as jest.MockedFunction<any>).mockResolvedValueOnce({data: {data: {events: []}}});
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_BILET_HTML,
    } as Response);

    // Test 1: Today (2026-09-05) - event is upcoming
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T12:00:00+03:00'));

    const upcomingEvents = await fetchEvents();
    expect(upcomingEvents.some(e => e.id === 'bilet-hello-campus-party')).toBe(true);

    // Test 2: On October 2nd, 2026 (the day after party ends) - event must be automatically removed!
    (api.get as jest.MockedFunction<any>).mockResolvedValueOnce({data: {data: {events: []}}});
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_BILET_HTML,
    } as Response);

    jest.setSystemTime(new Date('2026-10-02T00:01:00+03:00'));
    const expiredEvents = await fetchEvents();
    expect(expiredEvents.some(e => e.id === 'bilet-hello-campus-party')).toBe(false);
  });
});
