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
    methods: ['GET', 'POST']
  }
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.get('/', (req, res) => {
  res.send('Whiteboard backend is live!');
});

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  socket.on('join-room', async (roomId) => {
    socket.join(roomId);
    console.log(`👤 User joined room: ${roomId}`);

    await Room.findOneAndUpdate(
      { roomId },
      { roomId },
      { upsert: true, new: true }
    );
  });

  socket.on('draw', (data) => {
    console.log(`✏️ Drawing in room: ${data.roomId}`);
    socket.to(data.roomId).emit('draw', data);
  });

  socket.on('clear', (roomId) => {
    console.log(`🧹 Clear request in room: ${roomId}`);
    socket.to(roomId).emit('clear');
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
