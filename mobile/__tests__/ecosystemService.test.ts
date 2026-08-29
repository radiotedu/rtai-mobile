import {beforeEach, describe, expect, it, jest} from '@jest/globals';

import api from '../src/services/api';
import {
  fetchErpIdentityStatus,
  fetchMyTickets,
  fetchRoomAccess,
} from '../src/services/ecosystem';
import {
  STUDIO_RESERVATION_URL,
  fetchEcosystemTickets,
  fetchRoomAccessEligibility,
  trustedTicketDetailUrl,
} from '../src/services/ecosystemService';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {get: jest.fn()},
}));

describe('ecosystem service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads ERP permissions, tickets and room access through the authenticated API client', async () => {
    const getMock = api.get as jest.MockedFunction<(path: string) => Promise<any>>;
    getMock
      .mockResolvedValueOnce({data: {data: {linked: true, roles: ['staff'], permissions: ['room.attendance']}}})
      .mockResolvedValueOnce({data: {data: [{id: 7, code: 'RT-7'}]}})
      .mockResolvedValueOnce({data: {data: {enabled: true, mode: 'rotating_room_qr'}}});

    await expect(fetchErpIdentityStatus()).resolves.toMatchObject({
      linked: true,
      permissions: ['room.attendance'],
    });
    await expect(fetchMyTickets()).resolves.toEqual([{id: 7, code: 'RT-7'}]);
    await expect(fetchRoomAccess()).resolves.toMatchObject({
      enabled: true,
      mode: 'rotating_room_qr',
    });

    expect(getMock).toHaveBeenNthCalledWith(1, '/auth/erp-link/status');
    expect(getMock).toHaveBeenNthCalledWith(2, '/ecosystem/tickets');
    expect(getMock).toHaveBeenNthCalledWith(3, '/ecosystem/room-access');
  });
});

describe('RadioTEDU ecosystem dashboard service', () => {
  const getMock = api.get as jest.MockedFunction<(path: string) => Promise<any>>;

  beforeEach(() => {
    getMock.mockReset();
  });

  it('uses the existing authenticated ticket and ERP-gated room APIs', async () => {
    getMock
      .mockResolvedValueOnce({data: {data: [{id: 1, title: 'RadioTEDU Event'}]}})
      .mockResolvedValueOnce({data: {data: {enabled: true, mode: 'rotating_room_qr'}}});

    await expect(fetchEcosystemTickets()).resolves.toEqual([{id: 1, title: 'RadioTEDU Event'}]);
    await expect(fetchRoomAccessEligibility()).resolves.toEqual({
      enabled: true,
      mode: 'rotating_room_qr',
    });
    expect(getMock).toHaveBeenNthCalledWith(1, '/ecosystem/tickets');
    expect(getMock).toHaveBeenNthCalledWith(2, '/ecosystem/room-access');
    expect(STUDIO_RESERVATION_URL).toBe('https://radiotedu.com/erp/room/reservation');
  });

  it('keeps Oda QR hidden when the account lacks ERP access', async () => {
    getMock.mockRejectedValueOnce({isAxiosError: true, response: {status: 403}});
    await expect(fetchRoomAccessEligibility()).resolves.toBeNull();
  });

  it('accepts only credential-free HTTPS ticket pages on the RadioTEDU bilet path', () => {
    expect(trustedTicketDetailUrl('https://radiotedu.com/bilet/bilet_goster.php?code=example'))
      .toBe('https://radiotedu.com/bilet/bilet_goster.php?code=example');
    expect(trustedTicketDetailUrl('http://radiotedu.com/bilet/ticket')).toBeNull();
    expect(trustedTicketDetailUrl('https://radiotedu.com.evil.example/bilet/ticket')).toBeNull();
    expect(trustedTicketDetailUrl('https://user:password@radiotedu.com/bilet/ticket')).toBeNull();
    expect(trustedTicketDetailUrl('https://radiotedu.com/erp/dashboard')).toBeNull();
  });
});
