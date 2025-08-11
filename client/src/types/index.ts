export interface SessionConfig {
  sessionId: string;
  mode: 'p2p' | 'sfu';
  role: 'presenter' | 'viewer';
}

export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  role: 'presenter' | 'viewer';
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-session' | 'leave-session' | 'session-created';
  sessionId: string;
  fromId: string;
  toId?: string;
  data?: any;
}

export interface SessionMetrics {
  latency: number[];
  cpuUsage: number;
  timestamp: number;
}

export interface TimestampPixel {
  x: number;
  y: number;
  timestamp: number;
}