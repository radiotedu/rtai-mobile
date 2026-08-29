import axios from 'axios';

import api from './api';

export const STUDIO_RESERVATION_URL = 'https://radiotedu.com/erp/room/reservation';
export const BILET_HOME_URL = 'https://radiotedu.com/bilet/';

export interface EcosystemTicket {
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
}

export interface RoomAccess {
  enabled: boolean;
  mode: 'rotating_room_qr';
  display_url: string;
  instructions: string;
}

function unwrapData<T>(response: {data?: {data?: T}}): T {
  return response.data?.data as T;
}

export async function fetchEcosystemTickets(): Promise<EcosystemTicket[]> {
  const response = await api.get('/ecosystem/tickets');
  const data = unwrapData<unknown>(response);
  return Array.isArray(data) ? data as EcosystemTicket[] : [];
}

export async function fetchRoomAccessEligibility(): Promise<RoomAccess | null> {
  try {
    const response = await api.get('/ecosystem/room-access');
    const data = unwrapData<RoomAccess | undefined>(response);
    return data?.enabled === true ? data : null;
  } catch (error) {
    if (axios.isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0)) {
      return null;
    }
    throw error;
  }
}

export function trustedTicketDetailUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const url = new URL(value);
    const trustedHost = url.hostname.toLowerCase() === 'radiotedu.com';
    const trustedPath = url.pathname === '/bilet'
      || url.pathname.startsWith('/bilet/');
    if (url.protocol !== 'https:' || !trustedHost || !trustedPath || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
