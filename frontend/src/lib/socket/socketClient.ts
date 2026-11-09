import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket) {
    if (socket.connected) {
      return socket;
    }
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true
  });

  socket.on("connect", () => {
    console.log("[Socket.IO Client] Connected to server:", socket?.id);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket.IO Client] Connection error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket.IO Client] Disconnected:", reason);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinProjectRoom(projectId: string): void {
  if (socket && socket.connected) {
    socket.emit("join_project", { projectId });
  }
}

export function leaveProjectRoom(projectId: string): void {
  if (socket && socket.connected) {
    socket.emit("leave_project", { projectId });
  }
}
