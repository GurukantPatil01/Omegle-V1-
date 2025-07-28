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
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users and their rooms
const connectedUsers = new Map();
const waitingUsers = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining the chat
  socket.on('join-chat', () => {
    console.log(`User ${socket.id} wants to join chat`);
    
    if (waitingUsers.length > 0) {
      // Match with waiting user
      const partner = waitingUsers.shift();
      const roomId = `room_${Date.now()}`;
      
      // Add both users to the room
      socket.join(roomId);
      partner.join(roomId);
      
      // Store room information
      connectedUsers.set(socket.id, { roomId, partnerId: partner.id });
      connectedUsers.set(partner.id, { roomId, partnerId: socket.id });
      
      // Notify both users they are matched
      socket.emit('matched', { roomId, partnerId: partner.id });
      partner.emit('matched', { roomId, partnerId: socket.id });
      
      console.log(`Users ${socket.id} and ${partner.id} matched in room ${roomId}`);
    } else {
      // Add to waiting list
      waitingUsers.push(socket);
      socket.emit('waiting');
      console.log(`User ${socket.id} added to waiting list`);
    }
  });

  // Handle SDP offer
  socket.on('offer', (data) => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      socket.to(userInfo.roomId).emit('offer', {
        offer: data.offer,
        from: socket.id
      });
      console.log(`SDP offer forwarded from ${socket.id} to ${userInfo.partnerId}`);
    }
  });

  // Handle SDP answer
  socket.on('answer', (data) => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      socket.to(userInfo.roomId).emit('answer', {
        answer: data.answer,
        from: socket.id
      });
      console.log(`SDP answer forwarded from ${socket.id} to ${userInfo.partnerId}`);
    }
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      socket.to(userInfo.roomId).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
      console.log(`ICE candidate forwarded from ${socket.id} to ${userInfo.partnerId}`);
    }
  });

  // Handle next partner request
  socket.on('next-partner', () => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      // Notify current partner
      socket.to(userInfo.roomId).emit('partner-left');
      
      // Remove from current room
      socket.leave(userInfo.roomId);
      connectedUsers.delete(socket.id);
      
      // Add to waiting list for new partner
      waitingUsers.push(socket);
      socket.emit('waiting');
      console.log(`User ${socket.id} requested next partner`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove from waiting list if present
    const waitingIndex = waitingUsers.findIndex(user => user.id === socket.id);
    if (waitingIndex !== -1) {
      waitingUsers.splice(waitingIndex, 1);
    }
    
    // Handle room cleanup
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      socket.to(userInfo.roomId).emit('partner-left');
      connectedUsers.delete(socket.id);
      connectedUsers.delete(userInfo.partnerId);
    }
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
}); 