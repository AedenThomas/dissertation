const mediasoup = require('mediasoup');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const socketClient = require('socket.io-client');
const cors = require('cors');
const config = require('./config');

class SFUServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.workers = [];
    this.routers = new Map();
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
        routers: this.routers.size
      });
    });

    this.app.get('/sessions', (req, res) => {
      const sessions = Array.from(this.sessions.values()).map(session => ({
        id: session.id,
        producerCount: session.producers.size,
        consumerCount: session.consumers.size,
        createdAt: session.createdAt
      }));
      
      res.json({ sessions });
    });
  }

  async init() {
    console.log('Initializing SFU Server...');
    
    await this.createWorkers();
    this.connectToSignalingServer();
    
    this.server.listen(config.server.port, () => {
      console.log(`SFU Server running on port ${config.server.port}`);
      console.log(`Health check: http://localhost:${config.server.port}/health`);
    });
  }

  async createWorkers() {
    const numWorkers = config.mediasoup.numWorkers;
    console.log(`Creating ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
      });

      worker.on('died', (error) => {
        console.error('Mediasoup worker died:', error);
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
      console.log(`Worker ${i + 1} created`);
    }
  }

  connectToSignalingServer() {
    this.signalingSocket = socketClient(config.server.signalingServerUrl);
    
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

  getWorker() {
    return this.workers[Math.floor(Math.random() * this.workers.length)];
  }

  async getRouter(sessionId) {
    if (!this.routers.has(sessionId)) {
      const worker = this.getWorker();
      const router = await worker.createRouter({
        mediaCodecs: config.mediasoup.router.mediaCodecs,
      });

      console.log(`Router created for session ${sessionId}`);
      this.routers.set(sessionId, router);
      
      router.on('close', () => {
        console.log(`Router closed for session ${sessionId}`);
        this.routers.delete(sessionId);
      });
    }

    return this.routers.get(sessionId);
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
        router: await this.getRouter(sessionId),
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        clients: new Set(),
        createdAt: Date.now()
      });
    }

    const session = this.sessions.get(sessionId);
    session.clients.add(clientId);
    
    console.log(`Client ${clientId} joined SFU session ${sessionId}`);
  }

  async handleLeaveSession(sessionId, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.clients.delete(clientId);
    
    session.transports.forEach((transport, transportId) => {
      if (transportId.startsWith(clientId)) {
        transport.close();
        session.transports.delete(transportId);
      }
    });

    session.producers.forEach((producer, producerId) => {
      if (producerId.startsWith(clientId)) {
        producer.close();
        session.producers.delete(producerId);
      }
    });

    session.consumers.forEach((consumer, consumerId) => {
      if (consumerId.startsWith(clientId)) {
        consumer.close();
        session.consumers.delete(consumerId);
      }
    });

    if (session.clients.size === 0) {
      session.router.close();
      this.sessions.delete(sessionId);
      console.log(`SFU session ${sessionId} deleted (empty)`);
    }

    console.log(`Client ${clientId} left SFU session ${sessionId}`);
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`SFU client connected: ${socket.id}`);

      socket.on('getRouterRtpCapabilities', async (data, callback) => {
        try {
          const { sessionId } = data;
          const router = await this.getRouter(sessionId);
          callback(null, router.rtpCapabilities);
        } catch (error) {
          console.error('Error getting router capabilities:', error);
          callback(error.message);
        }
      });

      socket.on('createWebRtcTransport', async (data, callback) => {
        try {
          const { sessionId, direction } = data;
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            throw new Error('Session not found');
          }

          const transport = await session.router.createWebRtcTransport({
            ...config.mediasoup.webRtcTransport,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
          });

          const transportId = `${socket.id}-${direction}`;
          session.transports.set(transportId, transport);

          transport.on('dtlsstatechange', (dtlsState) => {
            console.log(`Transport ${transportId} DTLS state: ${dtlsState}`);
          });

          transport.on('close', () => {
            console.log(`Transport ${transportId} closed`);
            session.transports.delete(transportId);
          });

          callback(null, {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          });

        } catch (error) {
          console.error('Error creating WebRTC transport:', error);
          callback(error.message);
        }
      });

      socket.on('connectTransport', async (data, callback) => {
        try {
          const { sessionId, direction, dtlsParameters } = data;
          const session = this.sessions.get(sessionId);
          const transportId = `${socket.id}-${direction}`;
          const transport = session.transports.get(transportId);

          if (!transport) {
            throw new Error('Transport not found');
          }

          await transport.connect({ dtlsParameters });
          callback(null);

        } catch (error) {
          console.error('Error connecting transport:', error);
          callback(error.message);
        }
      });

      socket.on('produce', async (data, callback) => {
        try {
          const { sessionId, kind, rtpParameters } = data;
          const session = this.sessions.get(sessionId);
          const transportId = `${socket.id}-send`;
          const transport = session.transports.get(transportId);

          if (!transport) {
            throw new Error('Send transport not found');
          }

          const producer = await transport.produce({
            kind,
            rtpParameters,
          });

          const producerId = `${socket.id}-${kind}`;
          session.producers.set(producerId, producer);

          producer.on('close', () => {
            console.log(`Producer ${producerId} closed`);
            session.producers.delete(producerId);
          });

          socket.to(`sfu-${sessionId}`).emit('newProducer', {
            producerId: producer.id,
            kind: producer.kind,
          });

          callback(null, { id: producer.id });

        } catch (error) {
          console.error('Error creating producer:', error);
          callback(error.message);
        }
      });

      socket.on('consume', async (data, callback) => {
        try {
          const { sessionId, producerId, rtpCapabilities } = data;
          const session = this.sessions.get(sessionId);
          const transportId = `${socket.id}-recv`;
          const transport = session.transports.get(transportId);

          if (!transport) {
            throw new Error('Receive transport not found');
          }

          const router = session.router;
          if (!router.canConsume({ producerId, rtpCapabilities })) {
            throw new Error('Cannot consume this producer');
          }

          const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: true,
          });

          const consumerId = `${socket.id}-${producerId}`;
          session.consumers.set(consumerId, consumer);

          consumer.on('close', () => {
            console.log(`Consumer ${consumerId} closed`);
            session.consumers.delete(consumerId);
          });

          callback(null, {
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          });

        } catch (error) {
          console.error('Error creating consumer:', error);
          callback(error.message);
        }
      });

      socket.on('resume', async (data, callback) => {
        try {
          const { sessionId, consumerId } = data;
          const session = this.sessions.get(sessionId);
          const consumer = session.consumers.get(`${socket.id}-${consumerId}`);

          if (!consumer) {
            throw new Error('Consumer not found');
          }

          await consumer.resume();
          callback(null);

        } catch (error) {
          console.error('Error resuming consumer:', error);
          callback(error.message);
        }
      });

      socket.on('joinSfuSession', (data) => {
        const { sessionId } = data;
        socket.join(`sfu-${sessionId}`);
        console.log(`Client ${socket.id} joined SFU room: sfu-${sessionId}`);
      });

      socket.on('disconnect', () => {
        console.log(`SFU client disconnected: ${socket.id}`);
        
        this.sessions.forEach((session, sessionId) => {
          if (session.clients.has(socket.id)) {
            this.handleLeaveSession(sessionId, socket.id);
          }
        });
      });
    });
  }
}

const sfuServer = new SFUServer();
sfuServer.init().catch(console.error);

process.on('SIGINT', () => {
  console.log('Shutting down SFU server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down SFU server...');
  process.exit(0);
});