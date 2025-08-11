// +++++ START OF FINAL, CORRECTED webrtc.ts +++++
import io, { Socket } from 'socket.io-client';
import { SessionConfig } from '../types';

// The 'export' keyword was the missing piece.
export class WebRTCService {
  private socket: Socket;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private config: SessionConfig;

  public onRemoteStream?: (stream: MediaStream, peerId: string) => void;
  public onPeerDisconnected?: (peerId: string) => void;

  constructor(config: SessionConfig, localStream: MediaStream, signalingServerUrl: string = 'http://signaling-server:3001') {
    this.config = config;
    this.localStream = localStream;
    this.socket = io(signalingServerUrl, {
      transports: ['websocket'],
      forceNew: true,
    });
  }

  public connect() {
    this.setupSocketListeners();
    this.socket.connect();
  }

  private setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log(`Connected to signaling server with ID: ${this.socket.id}`);
      this.joinSession();
    });

    this.socket.on('offer', async (data: { fromId: string; description: RTCSessionDescriptionInit }) => {
      console.log(`Received offer from ${data.fromId}`);
      const peerConnection = this.getOrCreatePeerConnection(data.fromId, false); // Do not create an offer back
      if (peerConnection.signalingState !== 'stable') {
        console.warn(`Signaling state is not stable for offer from ${data.fromId}, ignoring.`);
        return;
      }
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.description));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      this.socket.emit('answer', { toId: data.fromId, description: peerConnection.localDescription });
    });

    this.socket.on('answer', async (data: { fromId: string; description: RTCSessionDescriptionInit }) => {
      console.log(`Received answer from ${data.fromId}`);
      const peerConnection = this.peerConnections.get(data.fromId);
      if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.description));
      }
    });

    this.socket.on('peer-joined', (peerId: string) => {
      if (this.config.role === 'presenter' && this.localStream && peerId !== this.socket.id) {
        console.log(`New peer ${peerId} joined, creating offer...`);
        this.getOrCreatePeerConnection(peerId, true); // Force offer creation
      }
    });

    this.socket.on('peer-left', (peerId: string) => {
      console.log(`Peer ${peerId} left`);
      this.removePeer(peerId);
    });

    this.socket.on('ice-candidate', (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
      const peerConnection = this.peerConnections.get(data.fromId);
      if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error("Error adding ICE candidate", e));
      }
    });
  }

  private getOrCreatePeerConnection(peerId: string, shouldCreateOffer: boolean): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const rtcConfig: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const peerConnection = new RTCPeerConnection(rtcConfig);
    this.peerConnections.set(peerId, peerConnection);

    if (this.localStream && this.config.role === 'presenter') {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    peerConnection.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`);
      if (this.onRemoteStream) this.onRemoteStream(event.streams[0], peerId);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) this.socket.emit('ice-candidate', { toId: peerId, candidate: event.candidate });
    };
    
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') this.removePeer(peerId);
    };

    if (shouldCreateOffer && this.config.role === 'presenter') {
      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => this.socket.emit('offer', { toId: peerId, description: peerConnection.localDescription }));
    }
    
    return peerConnection;
  }
  
  private joinSession() {
    this.socket.emit('join-session', { sessionId: this.config.sessionId, role: this.config.role });
  }

  private removePeer(peerId: string) {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(peerId);
      if (this.onPeerDisconnected) this.onPeerDisconnected(peerId);
    }
  }

  public disconnect() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    if (this.socket && this.socket.connected) this.socket.disconnect();
    console.log('Disconnected from WebRTC service');
  }
}
// +++++ END OF FINAL, CORRECTED webrtc.ts +++++