import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Project } from "../models/Project.js";
import { Organization } from "../models/Organization.js";
import { UserPayload } from "../services/auth.service.js";

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: UserPayload;
  };
}

let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function setupSocketIO(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: [env.CLIENT_URL, "http://localhost:5173", "http://localhost:3000"],
      credentials: true
    }
  });

  ioInstance = io;

  // JWT Authentication Middleware for Socket.IO
  io.use((socket: Socket, next: (err?: Error) => void) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization &&
        socket.handshake.headers.authorization.startsWith("Bearer ") &&
        socket.handshake.headers.authorization.substring(7));

    if (!token) {
      return next(new Error("UNAUTHORIZED: Authentication token required"));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as UserPayload;
      socket.data.user = decoded;
      next();
    } catch {
      return next(new Error("UNAUTHORIZED: Invalid or expired authentication token"));
    }
  });

  io.on("connection", (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const user = socket.data.user;
    console.log(`[Socket.IO] Authenticated user connected: ${user?.email} (Socket: ${socket.id})`);

    // Automatically join user-specific notification room
    if (user?.userId) {
      socket.join(`user:${user.userId}`);
    }

    socket.on("join_project", async (data: { projectId: string }, callback?: (response: unknown) => void) => {
      try {
        const projectId = data?.projectId;
        if (!projectId) {
          if (callback) callback({ ok: false, error: "Project ID required" });
          return;
        }

        const project = await Project.findById(projectId);
        if (!project) {
          if (callback) callback({ ok: false, error: "Project not found" });
          return;
        }

        // Check user access
        const userId = user?.userId;
        const org = await Organization.findById(project.orgId);
        const isOrgAdmin = org?.members.some((m) => m.userId.toString() === userId && m.role === "admin");
        const isProjectMember = project.members.some((m) => m.userId.toString() === userId);

        if (!isOrgAdmin && !isProjectMember) {
          if (callback) callback({ ok: false, error: "Forbidden: Not a project member" });
          return;
        }

        const roomName = `project:${projectId}`;
        socket.join(roomName);
        console.log(`[Socket.IO] ${user?.email} joined room ${roomName}`);
        if (callback) callback({ ok: true, room: roomName });
      } catch (err) {
        if (callback) callback({ ok: false, error: String(err) });
      }
    });

    socket.on("leave_project", (data: { projectId: string }) => {
      if (data?.projectId) {
        const roomName = `project:${data.projectId}`;
        socket.leave(roomName);
        console.log(`[Socket.IO] ${user?.email} left room ${roomName}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] User disconnected: ${user?.email} (${socket.id})`);
    });
  });

  return io;
}
