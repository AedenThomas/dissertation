const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const socketClient = require('socket.io-client');
const cors = require('cors');

class MockSFUServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.sessions = new Map();
    this.signalingSocket = null;

    this.setupExpress();
    this.setupSocketHandlers();
  }

  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());

    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        sessions: this.sessions.size,
        mode: 'mock'
      });
    });

    this.app.get('/sessions', (req, res) => {
      const sessions = Array.from(this.sessions.values()).map(session => ({
        id: session.id,
        clientCount: session.clients.size,
        createdAt: session.createdAt
      }));
      
      res.json({ sessions });
    });
  }

  async init() {
    console.log('Initializing Mock SFU Server...');
    
    this.connectToSignalingServer();
    
    this.server.listen(3002, () => {
      console.log('Mock SFU Server running on port 3002');
      console.log('Health check: http://localhost:3002/health');
      console.log('Note: This is a mock SFU for testing purposes');
    });
  }

  connectToSignalingServer() {
    this.signalingSocket = socketClient('http://signaling-server:3001');
    
    this.signalingSocket.on('connect', () => {
      console.log('Connected to signaling server');
      this.signalingSocket.emit('sfu-server-ready');
    });

    this.signalingSocket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
    });

    this.signalingSocket.on('sfu-session-request', async (data) => {
      await this.handleSessionRequest(data);
    });
  }

  async handleSessionRequest(data) {
    const { sessionId, action, clientId } = data;
    
    try {
      switch (action) {
        case 'join':
          await this.handleJoinSession(sessionId, clientId);
          break;
        case 'leave':
          await this.handleLeaveSession(sessionId, clientId);
          break;
        default:
          console.log(`Unknown session action: ${action}`);
      }
    } catch (error) {
      console.error('Error handling session request:', error);
    }
  }

  async handleJoinSession(sessionId, clientId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        clients: new Set(),
        createdAt: Date.now()
      });
    }

    const session = this.sessions.get(sessionId);
    session.clients.add(clientId);
    
    console.log(`Client ${clientId} joined Mock SFU session ${sessionId}`);
  }

  async handleLeaveSession(sessionId, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.clients.delete(clientId);

    if (session.clients.size === 0) {
      this.sessions.delete(sessionId);
      console.log(`Mock SFU session ${sessionId} deleted (empty)`);
    }

    console.log(`Client ${clientId} left Mock SFU session ${sessionId}`);
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Mock SFU client connected: ${socket.id}`);

      socket.on('getRouterRtpCapabilities', async (data, callback) => {
        try {
          console.log('Mock: getRouterRtpCapabilities');
          callback(null, {
            codecs: [
              {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000
              }
            ]
          });
        } catch (error) {
          callback(error.message);
        }
      });

      socket.on('createWebRtcTransport', async (data, callback) => {
        try {
          console.log('Mock: createWebRtcTransport');
          callback(null, {
            id: `mock-transport-${Date.now()}`,
            iceParameters: { usernameFragment: 'mock', password: 'mock' },
            iceCandidates: [],
            dtlsParameters: { 
              fingerprints: [{ algorithm: 'sha-256', value: 'mock-fingerprint' }],
              role: 'auto'
            }
          });
        } catch (error) {
          callback(error.message);
        }
      });

      socket.on('connectTransport', async (data, callback) => {
        try {
          console.log('Mock: connectTransport');
          callback(null);
        } catch (error) {
          callback(error.message);
        }
      });

      socket.on('produce', async (data, callback) => {
        try {
          console.log('Mock: produce');
          callback(null, { id: `mock-producer-${Date.now()}` });
        } catch (error) {
          callback(error.message);
        }
      });

      socket.on('consume', async (data, callback) => {
        try {
          console.log('Mock: consume');
          callback(null, {
            id: `mock-consumer-${Date.now()}`,
            producerId: data.producerId,
            kind: 'video',
            rtpParameters: {}
          });
        } catch (error) {
          callback(error.message);
        }
      });

      socket.on('resume', async (data, callback) => {
        try {
          console.log('Mock: resume');
          callback(null);
        } catch (error) {
          callback(error.message);
        }
      });

      socket.on('joinSfuSession', (data) => {
        const { sessionId } = data;
        socket.join(`sfu-${sessionId}`);
        console.log(`Client ${socket.id} joined Mock SFU room: sfu-${sessionId}`);
      });

      socket.on('disconnect', () => {
        console.log(`Mock SFU client disconnected: ${socket.id}`);
        
        this.sessions.forEach((session, sessionId) => {
          if (session.clients.has(socket.id)) {
            this.handleLeaveSession(sessionId, socket.id);
          }
        });
      });
    });
  }
}

const mockSfuServer = new MockSFUServer();
mockSfuServer.init().catch(console.error);

process.on('SIGINT', () => {
  console.log('Shutting down Mock SFU server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down Mock SFU server...');
  process.exit(0);
});