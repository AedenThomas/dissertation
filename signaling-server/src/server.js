const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.clients = new Map();
  }

  createSession(sessionId, mode = 'p2p') {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        mode: mode,
        presenter: null,
        viewers: new Set(),
        createdAt: Date.now()
      });
      console.log(`Session created: ${sessionId} (${mode})`);
    }
    return this.sessions.get(sessionId);
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  addClientToSession(sessionId, clientId, role, mode = 'p2p') {
    const session = this.createSession(sessionId, mode);
    
    if (role === 'presenter') {
      if (session.presenter) {
        throw new Error('Session already has a presenter');
      }
      session.presenter = clientId;
    } else {
      session.viewers.add(clientId);
    }

    this.clients.set(clientId, {
      id: clientId,
      sessionId: sessionId,
      role: role,
      joinedAt: Date.now()
    });

    console.log(`Client ${clientId} joined session ${sessionId} as ${role}`);
    return session;
  }

  removeClientFromSession(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return null;

    const session = this.sessions.get(client.sessionId);
    if (!session) return null;

    if (client.role === 'presenter') {
      session.presenter = null;
    } else {
      session.viewers.delete(clientId);
    }

    this.clients.delete(clientId);
    console.log(`Client ${clientId} left session ${client.sessionId}`);

    if (!session.presenter && session.viewers.size === 0) {
      this.sessions.delete(client.sessionId);
      console.log(`Session ${client.sessionId} deleted (empty)`);
    }

    return { session, client };
  }

  getSessionClients(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const clients = [];
    if (session.presenter) {
      clients.push(session.presenter);
    }
    clients.push(...Array.from(session.viewers));
    return clients;
  }
}

const sessionManager = new SessionManager();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/sessions', (req, res) => {
  const sessions = Array.from(sessionManager.sessions.values()).map(session => ({
    id: session.id,
    mode: session.mode,
    presenterConnected: !!session.presenter,
    viewerCount: session.viewers.size,
    createdAt: session.createdAt
  }));
  
  res.json({ sessions });
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-session', (data) => {
    try {
      const { sessionId, role, mode } = data;
      
      if (!sessionId || !role) {
        socket.emit('error', { message: 'Missing sessionId or role' });
        return;
      }

      const session = sessionManager.addClientToSession(sessionId, socket.id, role, mode);
      
      socket.join(sessionId);
      
      socket.emit('session-joined', {
        sessionId: sessionId,
        role: role,
        mode: session.mode
      });

      socket.to(sessionId).emit('peer-joined', socket.id);
      
      if (role === 'presenter') {
        const viewers = Array.from(session.viewers);
        socket.emit('existing-viewers', viewers);
      }

      console.log(`Session ${sessionId} status: presenter=${!!session.presenter}, viewers=${session.viewers.size}`);
      
    } catch (error) {
      console.error('Error joining session:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('signaling-message', (message) => {
    try {
      const { sessionId, toId, type, data } = message;
      
      if (!sessionId) {
        socket.emit('error', { message: 'Missing sessionId in signaling message' });
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      const client = sessionManager.clients.get(socket.id);
      if (!client || client.sessionId !== sessionId) {
        socket.emit('error', { message: 'Not authorized for this session' });
        return;
      }

      const forwardedMessage = {
        ...message,
        fromId: socket.id,
        timestamp: Date.now()
      };

      if (toId) {
        io.to(toId).emit('signaling-message', forwardedMessage);
        console.log(`Signaling message (${type}) from ${socket.id} to ${toId}`);
      } else {
        socket.to(sessionId).emit('signaling-message', forwardedMessage);
        console.log(`Broadcast signaling message (${type}) from ${socket.id} to session ${sessionId}`);
      }
      
    } catch (error) {
      console.error('Error handling signaling message:', error);
      socket.emit('error', { message: 'Failed to process signaling message' });
    }
  });

  socket.on('sfu-message', (message) => {
    try {
      const { sessionId, type, data } = message;
      
      if (!sessionId) {
        socket.emit('error', { message: 'Missing sessionId in SFU message' });
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session || session.mode !== 'sfu') {
        socket.emit('error', { message: 'SFU session not found' });
        return;
      }

      const forwardedMessage = {
        type: 'sfu-message',
        sessionId: sessionId,
        fromId: socket.id,
        sfuMessageType: type,
        data: data,
        timestamp: Date.now()
      };

      socket.to(`sfu-${sessionId}`).emit('sfu-message', forwardedMessage);
      console.log(`SFU message (${type}) from ${socket.id} for session ${sessionId}`);
      
    } catch (error) {
      console.error('Error handling SFU message:', error);
      socket.emit('error', { message: 'Failed to process SFU message' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    const result = sessionManager.removeClientFromSession(socket.id);
    if (result) {
      const { session, client } = result;
      socket.to(client.sessionId).emit('peer-left', socket.id);
      
      if (client.role === 'presenter') {
        socket.to(client.sessionId).emit('presenter-left');
      }
    }
  });

  socket.on('get-session-stats', () => {
    const client = sessionManager.clients.get(socket.id);
    if (client) {
      const session = sessionManager.getSession(client.sessionId);
      if (session) {
        socket.emit('session-stats', {
          sessionId: session.id,
          mode: session.mode,
          presenterConnected: !!session.presenter,
          viewerCount: session.viewers.size,
          uptime: Date.now() - session.createdAt
        });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Session info: http://localhost:${PORT}/sessions`);
});