// src/libs/socket.ts
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: corsOrigins.length > 0 ? corsOrigins : '*',
      methods: ['GET', 'POST', 'PUT'],
    },
  });

  io.on('connection', (socket: Socket) => {
    const nhomHoTroId = socket.handshake.query.nhom_ho_tro_id;
    if (nhomHoTroId) {
      socket.join(`group_${nhomHoTroId}`);
    }

    socket.on('join_ticket_room', (ticketId: string | number) => {
      socket.join(`ticket_${ticketId}`);
    });
  });

  return io;
};

export const getIo = (): Server => {
  if (!io) {
    throw new Error('Socket.IO chưa được khởi tạo thông qua initSocket(server)!');
  }
  return io;
};
