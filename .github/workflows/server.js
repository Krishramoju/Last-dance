const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const helmet = require('helmet'); // Ensure helmet is required
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // For development only
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet()); // Add at the top
app.set('trust proxy', 1); // For Render/Railway

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Track users
let users = new Map();

io.on('connection', (socket) => {
    console.log('New user connected');
    
    // Handle new user
    socket.on('new user', (username) => {
        users.set(socket.id, username);
        io.emit('user joined', username);
        updateUserList();
    });

    // Handle messages
    socket.on('chat message', (msg) => {
        const username = users.get(socket.id) || 'Anonymous';
        io.emit('chat message', { username, message: msg, time: new Date() });
    });

    // Handle typing indicator
    socket.on('typing', () => {
        const username = users.get(socket.id);
        if (username) socket.broadcast.emit('typing', username);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const username = users.get(socket.id);
        if (username) {
            io.emit('user left', username);
            users.delete(socket.id);
            updateUserList();
        }
    });

    // Update user list for all clients
    function updateUserList() {
        io.emit('user list', Array.from(users.values()));
    }
});

const PORT = process.env.PORT || 3000; // Always use this for cloud deployment
server.listen(PORT, '0.0.0.0', () => {  // Add '0.0.0.0' for Render/Railway
  console.log(`Server running on port ${PORT}`);
});
