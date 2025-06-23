import React, { useRef, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';

const socket = io('https://whiteboard-backend-zpz7.onrender.com');

const Whiteboard = () => {
  const { roomId } = useParams();
  const canvasRef = useRef(null);
  const tempCanvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(16);
  const [penSize, setPenSize] = useState(2);
  const [eraserSize, setEraserSize] = useState(10);
  const [drawing, setDrawing] = useState(false);
  const [objects, setObjects] = useState([]);
  const start = useRef({ x: 0, y: 0 });

  useEffect(() => {
    socket.emit('join-room', roomId);

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctxRef.current = ctx;

    const tempCanvas = tempCanvasRef.current;
    tempCanvas.width = window.innerWidth;
    tempCanvas.height = window.innerHeight;

    socket.on('draw', (data) => {
      const ctx = ctxRef.current;
      ctx.beginPath();
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.size || 2;

      if (data.type === 'line') {
        ctx.moveTo(data.x0, data.y0);
        ctx.lineTo(data.x1, data.y1);
        ctx.stroke();
      } else if (data.type === 'rect') {
        ctx.strokeRect(data.x0, data.y0, data.x1 - data.x0, data.y1 - data.y0);
      } else if (data.type === 'circle') {
        const r = Math.sqrt(Math.pow(data.x1 - data.x0, 2) + Math.pow(data.y1 - data.y0, 2));
        ctx.beginPath();
        ctx.arc(data.x0, data.y0, r, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (data.type === 'text') {
        ctx.fillStyle = data.color;
        ctx.font = `${data.size || 16}px sans-serif`;
        ctx.fillText(data.text, data.x0, data.y0);
      }
    });

    socket.on('clear', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
  }, [roomId]);

  const saveObject = (obj) => setObjects((prev) => [...prev, obj]);

  const startDraw = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    start.current = { x: offsetX, y: offsetY };

    if (tool === 'text') {
      alert('Tap to add text');
      const text = prompt('Enter text:');
      if (text) {
        const ctx = ctxRef.current;
        ctx.fillStyle = color;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillText(text, offsetX, offsetY);

        socket.emit('draw', {
          roomId,
          type: 'text',
          text,
          x0: offsetX,
          y0: offsetY,
          color,
          size: fontSize
        });

        saveObject({ type: 'text', text, x: offsetX, y: offsetY, color, size: fontSize });
      }
    } else if (tool === 'pen' || tool === 'eraser') {
      setDrawing(true);
      const ctx = ctxRef.current;
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = tool === 'eraser' ? eraserSize : penSize;
    } else {
      setDrawing(true);
    }
  };

  const draw = (e) => {
    if (!drawing) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const ctx = ctxRef.current;

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
      socket.emit('draw', {
        roomId,
        type: 'line',
        x0: start.current.x,
        y0: start.current.y,
        x1: offsetX,
        y1: offsetY,
        color: tool === 'eraser' ? '#ffffff' : color,
        size: tool === 'eraser' ? eraserSize : penSize,
      });
      start.current = { x: offsetX, y: offsetY };
    } else {
      const tempCtx = tempCanvasRef.current.getContext('2d');
      tempCtx.clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height);
      tempCtx.strokeStyle = color;

      if (tool === 'rectangle') {
        tempCtx.strokeRect(start.current.x, start.current.y, offsetX - start.current.x, offsetY - start.current.y);
      } else if (tool === 'circle') {
        const r = Math.sqrt((offsetX - start.current.x) ** 2 + (offsetY - start.current.y) ** 2);
        tempCtx.beginPath();
        tempCtx.arc(start.current.x, start.current.y, r, 0, 2 * Math.PI);
        tempCtx.stroke();
      }
    }
  };

  const stopDraw = (e) => {
    if (!drawing) return;
    setDrawing(false);
    const { offsetX, offsetY } = e.nativeEvent;
    const ctx = ctxRef.current;

    if (tool === 'rectangle') {
      ctx.strokeRect(start.current.x, start.current.y, offsetX - start.current.x, offsetY - start.current.y);
      socket.emit('draw', {
        roomId,
        type: 'rect',
        x0: start.current.x,
        y0: start.current.y,
        x1: offsetX,
        y1: offsetY,
        color
      });
    } else if (tool === 'circle') {
      const r = Math.sqrt((offsetX - start.current.x) ** 2 + (offsetY - start.current.y) ** 2);
      ctx.beginPath();
      ctx.arc(start.current.x, start.current.y, r, 0, 2 * Math.PI);
      ctx.stroke();
      socket.emit('draw', {
        roomId,
        type: 'circle',
        x0: start.current.x,
        y0: start.current.y,
        x1: offsetX,
        y1: offsetY,
        color
      });
    }
    tempCanvasRef.current.getContext('2d').clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height);
  };

  return (
    <div>
      <div style={{ position: 'fixed', top: 10, left: 10, zIndex: 10 }}>
        <select value={tool} onChange={(e) => setTool(e.target.value)}>
          <option value="pen">Pen</option>
          <option value="eraser">Eraser</option>
          <option value="text">Text</option>
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
        </select>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        {tool === 'pen' && <input type="range" min="1" max="20" value={penSize} onChange={(e) => setPenSize(+e.target.value)} />}
        {tool === 'eraser' && <input type="range" min="5" max="50" value={eraserSize} onChange={(e) => setEraserSize(+e.target.value)} />}
        {tool === 'text' && <input type="number" min="10" max="100" value={fontSize} onChange={(e) => setFontSize(+e.target.value)} />}
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseOut={stopDraw}
        style={{ border: '1px solid #ccc', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
      />
      <canvas
        ref={tempCanvasRef}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }}
      />
    </div>
  );
};

export default Whiteboard;
