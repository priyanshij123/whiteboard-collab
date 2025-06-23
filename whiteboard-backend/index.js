const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const Room = require('./models/Room');
require('dotenv').config();

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://whiteboard-collab-psi.vercel.app',
    methods: ['GET', 'POST'],
  },
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

io.on('connection', (socket) => {
  socket.on('join-room', async (roomId) => {
    socket.join(roomId);
    await Room.findOneAndUpdate(
      { roomId },
      { roomId },
      { upsert: true, new: true }
    );
  });

  socket.on('draw', ({ roomId, data }) => {
    socket.to(roomId).emit('draw', data);
  });

  socket.on('clear', (roomId) => {
    socket.to(roomId).emit('clear');
  });
});

server.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
