const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users and their rooms
const connectedUsers = new Map();
const waitingUsers = [];
const activeRooms = new Map();

// Logging utility
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  log(`User connected: ${socket.id}`, 'info');

  // Handle user joining the chat
  socket.on('join-chat', () => {
    log(`User ${socket.id} wants to join chat`, 'info');
    
    // Remove user from any existing room first
    const existingUser = connectedUsers.get(socket.id);
    if (existingUser) {
      log(`User ${socket.id} was already in room ${existingUser.roomId}, cleaning up`, 'warn');
      socket.leave(existingUser.roomId);
      connectedUsers.delete(socket.id);
      
      // Notify partner about disconnection
      const partner = io.sockets.sockets.get(existingUser.partnerId);
      if (partner) {
        partner.emit('partner-left');
        connectedUsers.delete(existingUser.partnerId);
      }
    }
    
    if (waitingUsers.length > 0) {
      // Match with waiting user
      const partner = waitingUsers.shift();
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      log(`Matching users ${socket.id} and ${partner.id} in room ${roomId}`, 'info');
      
      // Add both users to the room
      socket.join(roomId);
      partner.join(roomId);
      
      // Store room information
      connectedUsers.set(socket.id, { roomId, partnerId: partner.id });
      connectedUsers.set(partner.id, { roomId, partnerId: socket.id });
      activeRooms.set(roomId, { user1: socket.id, user2: partner.id, createdAt: Date.now() });
      
      // Notify both users they are matched
      socket.emit('matched', { roomId, partnerId: partner.id });
      partner.emit('matched', { roomId, partnerId: socket.id });
      
      log(`Users ${socket.id} and ${partner.id} successfully matched in room ${roomId}`, 'info');
    } else {
      // Add to waiting list
      waitingUsers.push(socket);
      socket.emit('waiting');
      log(`User ${socket.id} added to waiting list. Total waiting: ${waitingUsers.length}`, 'info');
    }
  });

  // Handle SDP offer
  socket.on('offer', (data) => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      log(`SDP offer from ${socket.id} to ${userInfo.partnerId}`, 'info');
      socket.to(userInfo.roomId).emit('offer', {
        offer: data.offer,
        from: socket.id
      });
    } else {
      log(`SDP offer from ${socket.id} but user not in room`, 'error');
    }
  });

  // Handle SDP answer
  socket.on('answer', (data) => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      log(`SDP answer from ${socket.id} to ${userInfo.partnerId}`, 'info');
      socket.to(userInfo.roomId).emit('answer', {
        answer: data.answer,
        from: socket.id
      });
    } else {
      log(`SDP answer from ${socket.id} but user not in room`, 'error');
    }
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      log(`ICE candidate from ${socket.id} to ${userInfo.partnerId}`, 'debug');
      socket.to(userInfo.roomId).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    } else {
      log(`ICE candidate from ${socket.id} but user not in room`, 'error');
    }
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      log(`Chat message from ${socket.id} to ${userInfo.partnerId}: "${data.message}"`, 'info');
      
      // Forward message to partner
      socket.to(userInfo.roomId).emit('chat-message', {
        message: data.message,
        from: socket.id,
        timestamp: new Date().toISOString()
      });
      
      // Send confirmation back to sender
      socket.emit('chat-message-sent', {
        message: data.message,
        timestamp: new Date().toISOString()
      });
    } else {
      log(`Chat message from ${socket.id} but user not in room`, 'error');
    }
  });

  // Handle next partner request
  socket.on('next-partner', () => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      log(`User ${socket.id} requested next partner`, 'info');
      
      // Notify current partner
      socket.to(userInfo.roomId).emit('partner-left');
      
      // Remove from current room
      socket.leave(userInfo.roomId);
      connectedUsers.delete(socket.id);
      activeRooms.delete(userInfo.roomId);
      
      // Add to waiting list for new partner
      waitingUsers.push(socket);
      socket.emit('waiting');
      log(`User ${socket.id} added back to waiting list`, 'info');
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    log(`User disconnected: ${socket.id}, reason: ${reason}`, 'info');
    
    // Remove from waiting list if present
    const waitingIndex = waitingUsers.findIndex(user => user.id === socket.id);
    if (waitingIndex !== -1) {
      waitingUsers.splice(waitingIndex, 1);
      log(`User ${socket.id} removed from waiting list`, 'info');
    }
    
    // Handle room cleanup
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      log(`Cleaning up room ${userInfo.roomId} for user ${socket.id}`, 'info');
      
      // Notify partner about disconnection
      socket.to(userInfo.roomId).emit('partner-left');
      
      // Clean up room data
      connectedUsers.delete(socket.id);
      connectedUsers.delete(userInfo.partnerId);
      activeRooms.delete(userInfo.roomId);
      
      log(`Room ${userInfo.roomId} cleaned up`, 'info');
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    log(`Socket error for ${socket.id}: ${error.message}`, 'error');
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
    waitingUsers: waitingUsers.length,
    activeRooms: activeRooms.size
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json({
    connectedUsers: connectedUsers.size,
    waitingUsers: waitingUsers.length,
    activeRooms: activeRooms.size,
    rooms: Array.from(activeRooms.entries()).map(([roomId, room]) => ({
      roomId,
      user1: room.user1,
      user2: room.user2,
      createdAt: new Date(room.createdAt).toISOString(),
      duration: Date.now() - room.createdAt
    }))
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  log(`Signaling server running on port ${PORT}`, 'info');
  log(`Open http://localhost:${PORT} in your browser`, 'info');
  log(`Health check: http://localhost:${PORT}/health`, 'info');
  log(`Stats: http://localhost:${PORT}/stats`, 'info');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully', 'info');
  server.close(() => {
    log('Server closed', 'info');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully', 'info');
  server.close(() => {
    log('Server closed', 'info');
    process.exit(0);
  });
}); 