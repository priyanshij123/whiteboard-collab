import React, { useRef, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';

const socket = io('https://whiteboard-backend-zpz7.onrender.com'); // Your Render backend URL

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
        ctx.arc(data.x0, data.y0, r, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });

    socket.on('clear', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
  }, [roomId]);

  const saveObject = (obj) => {
    setObjects((prev) => [...prev, obj]);
  };

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
        const width = offsetX - start.current.x;
        const height = offsetY - start.current.y;
        tempCtx.strokeRect(start.current.x, start.current.y, width, height);
      } else if (tool === 'circle') {
        const radius = Math.sqrt((offsetX - start.current.x) ** 2 + (offsetY - start.current.y) ** 2);
        tempCtx.beginPath();
        tempCtx.arc(start.current.x, start.current.y, radius, 0, 2 * Math.PI);
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
      const width = offsetX - start.current.x;
      const height = offsetY - start.current.y;
      ctx.strokeStyle = color;
      ctx.strokeRect(start.current.x, start.current.y, width, height);

      socket.emit('draw', {
        roomId,
        type: 'rect',
        x0: start.current.x,
        y0: start.current.y,
        x1: offsetX,
        y1: offsetY,
        color,
      });

      saveObject({ type: 'rect', x: start.current.x, y: start.current.y, w: width, h: height, color });
    }

    if (tool === 'circle') {
      const radius = Math.sqrt((offsetX - start.current.x) ** 2 + (offsetY - start.current.y) ** 2);
      ctx.beginPath();
      ctx.arc(start.current.x, start.current.y, radius, 0, 2 * Math.PI);
      ctx.stroke();

      socket.emit('draw', {
        roomId,
        type: 'circle',
        x0: start.current.x,
        y0: start.current.y,
        x1: offsetX,
        y1: offsetY,
        color,
      });

      saveObject({ type: 'circle', x: start.current.x, y: start.current.y, r: radius, color });
    }

    tempCanvasRef.current.getContext('2d').clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height);
  };

  const undo = () => {
    const newObjects = objects.slice(0, -1);
    setObjects(newObjects);
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    newObjects.forEach((obj) => {
      ctx.beginPath();
      ctx.strokeStyle = obj.color;
      ctx.fillStyle = obj.color;
      ctx.lineWidth = penSize;
      ctx.font = `${obj.size || 16}px sans-serif`;

      if (obj.type === 'text') ctx.fillText(obj.text, obj.x, obj.y);
      if (obj.type === 'rect') ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      if (obj.type === 'circle') {
        ctx.arc(obj.x, obj.y, obj.r, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });
  };

  const clearCanvas = () => {
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setObjects([]);
    socket.emit('clear', roomId);
  };

  const exportImage = () => {
    const dataURL = canvasRef.current.toDataURL();
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'whiteboard.png';
    link.click();
  };

  const exportPDF = () => {
    const dataURL = canvasRef.current.toDataURL();
    const pdf = new jsPDF();
    pdf.addImage(dataURL, 'PNG', 0, 0);
    pdf.save('whiteboard.pdf');
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

        {tool === 'pen' && (
          <input type="range" min="1" max="20" value={penSize} onChange={(e) => setPenSize(+e.target.value)} />
        )}

        {tool === 'eraser' && (
          <input type="range" min="5" max="50" value={eraserSize} onChange={(e) => setEraserSize(+e.target.value)} />
        )}

        {tool === 'text' && (
          <input type="number" min="10" max="100" value={fontSize} onChange={(e) => setFontSize(+e.target.value)} />
        )}

        <button onClick={undo}>Undo</button>
        <button onClick={clearCanvas}>Clear</button>
        <button onClick={exportImage}>Export PNG</button>
        <button onClick={exportPDF}>Export PDF</button>
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
