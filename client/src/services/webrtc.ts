import io, { Socket } from 'socket.io-client';
import { SignalingMessage, PeerConnection, SessionConfig } from '../types';

export class WebRTCService {
  private socket: Socket;
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private config: SessionConfig;
  private onRemoteStreamCallback?: (stream: MediaStream, peerId: string) => void;
  private onPeerDisconnectedCallback?: (peerId: string) => void;

  constructor(config: SessionConfig, signalingServerUrl: string = 'http://localhost:3001') {
    this.config = config;
    this.socket = io(signalingServerUrl);
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on('signaling-message', (message: SignalingMessage) => {
      this.handleSignalingMessage(message);
    });

    this.socket.on('peer-joined', (peerId: string) => {
      if (this.config.role === 'presenter') {
        this.createPeerConnection(peerId);
      }
    });

    this.socket.on('peer-left', (peerId: string) => {
      this.removePeer(peerId);
      this.onPeerDisconnectedCallback?.(peerId);
    });
  }

  async startScreenSharing(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          contentHint: 'detail'
        } as MediaTrackConstraints,
        audio: false
      });

      this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopScreenSharing();
      });

      return this.localStream;
    } catch (error) {
      console.error('Error starting screen sharing:', error);
      throw error;
    }
  }

  stopScreenSharing() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  async joinSession() {
    this.socket.emit('join-session', {
      sessionId: this.config.sessionId,
      role: this.config.role,
      mode: this.config.mode
    });
  }

  private async createPeerConnection(peerId: string): Promise<RTCPeerConnection> {
    const rtcConfig: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(rtcConfig);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          sessionId: this.config.sessionId,
          fromId: this.socket.id!,
          toId: peerId,
          data: event.candidate
        });
      }
    };

    peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.onRemoteStreamCallback?.(event.streams[0], peerId);
      }
    };

    if (this.localStream && this.config.role === 'presenter') {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    this.peers.set(peerId, {
      id: peerId,
      connection: peerConnection,
      role: this.config.role === 'presenter' ? 'viewer' : 'presenter'
    });

    if (this.config.role === 'presenter') {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.sendSignalingMessage({
        type: 'offer',
        sessionId: this.config.sessionId,
        fromId: this.socket.id!,
        toId: peerId,
        data: offer
      });
    }

    return peerConnection;
  }

  private async handleSignalingMessage(message: SignalingMessage) {
    if (message.toId && message.toId !== this.socket.id) {
      return;
    }

    switch (message.type) {
      case 'offer':
        await this.handleOffer(message);
        break;
      case 'answer':
        await this.handleAnswer(message);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(message);
        break;
    }
  }

  private async handleOffer(message: SignalingMessage) {
    const peerConnection = await this.createPeerConnection(message.fromId);
    await peerConnection.setRemoteDescription(message.data);
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    this.sendSignalingMessage({
      type: 'answer',
      sessionId: this.config.sessionId,
      fromId: this.socket.id!,
      toId: message.fromId,
      data: answer
    });
  }

  private async handleAnswer(message: SignalingMessage) {
    const peer = this.peers.get(message.fromId);
    if (peer) {
      await peer.connection.setRemoteDescription(message.data);
    }
  }

  private async handleIceCandidate(message: SignalingMessage) {
    const peer = this.peers.get(message.fromId);
    if (peer) {
      await peer.connection.addIceCandidate(message.data);
    }
  }

  private sendSignalingMessage(message: SignalingMessage) {
    this.socket.emit('signaling-message', message);
  }

  private removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
    }
  }

  onRemoteStream(callback: (stream: MediaStream, peerId: string) => void) {
    this.onRemoteStreamCallback = callback;
  }

  onPeerDisconnected(callback: (peerId: string) => void) {
    this.onPeerDisconnectedCallback = callback;
  }

  disconnect() {
    this.stopScreenSharing();
    this.peers.forEach(peer => peer.connection.close());
    this.peers.clear();
    this.socket.disconnect();
  }
}