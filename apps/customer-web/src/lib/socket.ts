import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('📡 Connected to PrintQR real-time gateway:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from PrintQR gateway');
    });
  }
  return socket;
};
