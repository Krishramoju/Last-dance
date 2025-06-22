const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active users per room
const activeUsers = {};

io.on('connection', (socket) => {
    console.log('New user connected');

    // Join room
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        socket.username = username;
        socket.room = room;

        // Add user to active users list
        if (!activeUsers[room]) {
            activeUsers[room] = new Set();
        }
        activeUsers[room].add(username);

        // Welcome current user
        socket.emit('message', {
            username: 'ChatBot',
            text: `Welcome to ${room}, ${username}!`,
            timestamp: new Date().toISOString()
        });

        // Broadcast to room that a user has joined
        socket.broadcast.to(room).emit('message', {
            username: 'ChatBot',
            text: `${username} has joined the chat`,
            timestamp: new Date().toISOString()
        });

        // Send updated user count
        io.to(room).emit('userCount', {
            room,
            count: activeUsers[room].size
        });
    });

    // Listen for chat messages
    socket.on('chatMessage', (messageData) => {
        io.to(messageData.room).emit('message', messageData);
    });

    // Listen for typing events
    socket.on('typing', ({ username, room }) => {
        socket.broadcast.to(room).emit('typing', { username, room });
    });

    // Listen for stop typing events
    socket.on('stopTyping', (room) => {
        socket.broadcast.to(room).emit('stopTyping', room);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (socket.room && socket.username) {
            // Remove user from active users list
            if (activeUsers[socket.room]) {
                activeUsers[socket.room].delete(socket.username);
                
                // Broadcast user left
                io.to(socket.room).emit('message', {
                    username: 'ChatBot',
                    text: `${socket.username} has left the chat`,
                    timestamp: new Date().toISOString()
                });

                // Update user count
                io.to(socket.room).emit('userCount', {
                    room: socket.room,
                    count: activeUsers[socket.room].size
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
