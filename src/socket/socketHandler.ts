import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

export const socketHandler = (io: Server): void => {
  // Authentication middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth['token'];
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      const user = await db('users')
        .where({ id: decoded.id, isActive: true })
        .first();

      if (!user) {
        return next(new Error('User not found'));
      }

      (socket as any).userId = user.id;
      (socket as any).username = user.username;
      
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const authSocket = socket as any;
    logger.info(`User ${authSocket.username} connected via socket`);

    // Join user to their personal room
    socket.join(`user:${authSocket.userId}`);

    // Join user to project rooms they're a member of
    socket.on('join-project', async (projectId: string) => {
      try {
        const membership = await db('project_members')
          .where({
            projectId,
            userId: authSocket.userId,
          })
          .first();

        if (membership) {
          socket.join(`project:${projectId}`);
          logger.info(`User ${authSocket.username} joined project room: ${projectId}`);
        }
      } catch (error) {
        logger.error('Error joining project room:', error);
      }
    });

    // Leave project room
    socket.on('leave-project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      logger.info(`User ${authSocket.username} left project room: ${projectId}`);
    });

    // Handle task updates
    socket.on('task-update', (data) => {
      // Broadcast to project members
      if (data.projectId) {
        socket.to(`project:${data.projectId}`).emit('task-updated', data);
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (data) => {
      socket.to(`project:${data.projectId}`).emit('user-typing', {
        userId: authSocket.userId,
        username: authSocket.username,
        taskId: data.taskId,
      });
    });

    socket.on('typing-stop', (data) => {
      socket.to(`project:${data.projectId}`).emit('user-stopped-typing', {
        userId: authSocket.userId,
        taskId: data.taskId,
      });
    });

    socket.on('disconnect', () => {
      logger.info(`User ${authSocket.username} disconnected`);
    });
  });

  // Helper functions for emitting events
  io.sendToUser = (userId: string, event: string, data: any) => {
    io.to(`user:${userId}`).emit(event, data);
  };

  io.sendToProject = (projectId: string, event: string, data: any) => {
    io.to(`project:${projectId}`).emit(event, data);
  };
};

// Extend Socket.IO types
declare module 'socket.io' {
  interface Server {
    sendToUser(userId: string, event: string, data: any): void;
    sendToProject(projectId: string, event: string, data: any): void;
  }
}
