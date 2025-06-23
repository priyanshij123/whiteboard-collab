import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Whiteboard from './Whiteboard';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Whiteboard />} />
      </Routes>
    </Router>
  );
};

const Home = () => {
  const createRoom = () => {
    window.location.href = `/room/${uuidv4()}`;
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>Collaborative Whiteboard</h1>
      <button onClick={createRoom}>Create New Room</button>
    </div>
  );
};

export default App;