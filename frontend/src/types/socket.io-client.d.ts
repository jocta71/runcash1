declare module 'socket.io-client' {
  import { Manager, Socket } from 'socket.io-client/build/esm';
  export { Manager, Socket };
  export const io: (
    uri: string,
    opts?: {
      transports?: string[];
      reconnection?: boolean;
      reconnectionAttempts?: number;
      reconnectionDelay?: number;
      [key: string]: any;
    }
  ) => Socket;
} 