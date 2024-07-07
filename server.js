const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', () => {
        const roomCode = Math.random().toString(36).substring(2, 7);
        rooms[roomCode] = { players: [socket.id] };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        updateRoomStatus(roomCode);
    });

    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode] && rooms[roomCode].players.length < 2) {
            rooms[roomCode].players.push(socket.id);
            socket.join(roomCode);
            socket.emit('roomJoined', roomCode);
            updateRoomStatus(roomCode);
        } else {
            socket.emit('roomError', 'Room is full or does not exist.');
        }
    });

    socket.on('leaveRoom', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].players = rooms[roomCode].players.filter(id => id !== socket.id);
            if (rooms[roomCode].players.length === 0) {
                delete rooms[roomCode];
            } else {
                updateRoomStatus(roomCode);
            }
            socket.leave(roomCode);
        }
    });

    socket.on('playerMovement', (data) => {
        const roomCode = Object.keys(rooms).find(code => rooms[code].players.includes(socket.id));
        if (roomCode) {
            socket.to(roomCode).emit('playerMovement', data);
        }
    });

    socket.on('disconnect', () => {
        const roomCode = Object.keys(rooms).find(code => rooms[code].players.includes(socket.id));
        if (roomCode) {
            rooms[roomCode].players = rooms[roomCode].players.filter(id => id !== socket.id);
            if (rooms[roomCode].players.length === 0) {
                delete rooms[roomCode];
            } else {
                updateRoomStatus(roomCode);
            }
        }
    });

    function updateRoomStatus(roomCode) {
        const room = rooms[roomCode];
        if (room) {
            io.in(roomCode).emit('updateRoom', room.players.length);
            if (room.players.length === 2) {
                io.in(roomCode).emit('startGame');
            }
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
