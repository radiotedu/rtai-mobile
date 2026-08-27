import api from './api';

export type ErpIdentityStatus = {
  linked: boolean;
  email?: string | null;
  display_name?: string | null;
  roles: string[];
  permissions: string[];
};

export type MobileTicket = {
  id: number;
  event_id: number;
  code: string;
  holder_name: string;
  payment_status: 'ucretsiz' | 'odend';
  checked_in: boolean;
  title: string;
  date: string;
  starts_at?: string | null;
  ends_at?: string | null;
  location: string;
  image_url?: string | null;
  detail_url: string;
  qr_payload: string;
};

export type RoomAccess = {
  enabled: boolean;
  mode: 'rotating_room_qr';
  display_url: string;
  instructions: string;
};

export async function fetchErpIdentityStatus(): Promise<ErpIdentityStatus> {
  const response = await api.get('/auth/erp-link/status');
  return response.data.data;
}

export async function fetchMyTickets(): Promise<MobileTicket[]> {
  const response = await api.get('/ecosystem/tickets');
  return response.data.data;
}

export async function fetchRoomAccess(): Promise<RoomAccess> {
  const response = await api.get('/ecosystem/room-access');
  return response.data.data;
}
