const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('createRoom', () => {
        const roomCode = uuidv4().slice(0, 6);
        rooms[roomCode] = { players: [] };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        console.log(`Room ${roomCode} created`);
    });

    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode] && rooms[roomCode].players.length < 2) {
            socket.join(roomCode);
            rooms[roomCode].players.push(socket.id);
            socket.emit('roomJoined', roomCode);
            io.in(roomCode).emit('updateRoom', rooms[roomCode].players.length);

            if (rooms[roomCode].players.length === 2) {
                io.in(roomCode).emit('startGame');
            }
        } else {
            socket.emit('error', 'Room not found or full');
        }
    });

    socket.on('disconnect', () => {
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const index = room.players.indexOf(socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                } else {
                    io.in(roomCode).emit('updateRoom', room.players.length);
                }
            }
        }
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
