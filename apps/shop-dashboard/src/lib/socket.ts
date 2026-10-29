import { io, Socket } from 'socket.io-client';
import { resolvePublicSocketUrl } from '../../../../packages/config/browser-urls.mjs';

const SOCKET_URL = resolvePublicSocketUrl(import.meta.env.VITE_SOCKET_URL, import.meta.env.VITE_API_URL, import.meta.env.PROD);

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('printqr_shop_token') },
      autoConnect: true,
    });
  }
  return socket;
};
