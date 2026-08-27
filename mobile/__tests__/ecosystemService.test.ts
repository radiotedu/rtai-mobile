import {beforeEach, describe, expect, it, jest} from '@jest/globals';

import api from '../src/services/api';
import {
  fetchErpIdentityStatus,
  fetchMyTickets,
  fetchRoomAccess,
} from '../src/services/ecosystem';

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
