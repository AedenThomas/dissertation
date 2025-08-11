// +++++ START OF NEW, CORRECTED webrtc.ts +++++

import io, { Socket } from "socket.io-client";
import { SessionConfig } from "../types";

// This is a simplified but more robust WebRTC service
export class WebRTCService {
  private socket: Socket;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private config: SessionConfig;

  // Callbacks for the UI to subscribe to
  public onRemoteStream?: (stream: MediaStream, peerId: string) => void;
  public onPeerDisconnected?: (peerId: string) => void;

  constructor(
    config: SessionConfig,
    signalingServerUrl: string = "http://signaling-server:3001"
  ) {
    this.config = config;
    this.socket = io(signalingServerUrl, {
      transports: ["websocket"], // More reliable in Docker environments
    });
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log(`Connected to signaling server with ID: ${this.socket.id}`);
      this.joinSession();
    });

    // A viewer receives an offer from the presenter
    this.socket.on(
      "offer",
      async (data: {
        fromId: string;
        description: RTCSessionDescriptionInit;
      }) => {
        console.log(`Received offer from ${data.fromId}`);
        const peerConnection = this.getOrCreatePeerConnection(data.fromId);
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.description)
        );

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        this.socket.emit("answer", {
          toId: data.fromId,
          description: peerConnection.localDescription,
        });
      }
    );

    // The presenter receives an answer from a viewer
    this.socket.on(
      "answer",
      async (data: {
        fromId: string;
        description: RTCSessionDescriptionInit;
      }) => {
        console.log(`Received answer from ${data.fromId}`);
        const peerConnection = this.peerConnections.get(data.fromId);
        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.description)
          );
        }
      }
    );

    // A new peer joins, if we are the presenter, we initiate the connection
    this.socket.on("peer-joined", (peerId: string) => {
      if (this.config.role === "presenter" && this.localStream) {
        console.log(`New peer ${peerId} joined, creating offer...`);
        this.getOrCreatePeerConnection(peerId);
      }
    });

    // A peer leaves the session
    this.socket.on("peer-left", (peerId: string) => {
      console.log(`Peer ${peerId} left`);
      this.removePeer(peerId);
    });

    // Handle ICE candidates
    this.socket.on(
      "ice-candidate",
      (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
        const peerConnection = this.peerConnections.get(data.fromId);
        if (peerConnection) {
          peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      }
    );
  }

  private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const rtcConfig: RTCConfiguration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };
    const peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local stream tracks if we are the presenter
    if (this.config.role === "presenter" && this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming tracks from the remote peer
    peerConnection.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`);
      if (this.onRemoteStream) {
        this.onRemoteStream(event.streams[0], peerId);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("ice-candidate", {
          toId: peerId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (
        peerConnection.connectionState === "disconnected" ||
        peerConnection.connectionState === "failed"
      ) {
        this.removePeer(peerId);
      }
    };

    this.peerConnections.set(peerId, peerConnection);

    // If we are the presenter, we need to create and send an offer
    if (this.config.role === "presenter") {
      peerConnection
        .createOffer()
        .then((offer) => peerConnection.setLocalDescription(offer))
        .then(() => {
          this.socket.emit("offer", {
            toId: peerId,
            description: peerConnection.localDescription,
          });
        });
    }

    return peerConnection;
  }

  public async startScreenSharing(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;
    try {
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: { contentHint: "detail" } as MediaTrackConstraints,
        audio: false,
      });

      // When user stops sharing via browser UI
      this.localStream.getVideoTracks()[0].addEventListener("ended", () => {
        this.disconnect();
      });

      return this.localStream;
    } catch (error) {
      console.error("Error starting screen sharing:", error);
      throw error;
    }
  }

  private joinSession() {
    this.socket.emit("join-session", {
      sessionId: this.config.sessionId,
      role: this.config.role,
      mode: this.config.mode,
    });
  }

  private removePeer(peerId: string) {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(peerId);
      if (this.onPeerDisconnected) {
        this.onPeerDisconnected(peerId);
      }
    }
  }

  public disconnect() {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.socket.disconnect();
    console.log("Disconnected from WebRTC service");
  }
}

// +++++ END OF NEW, CORRECTED webrtc.ts +++++
