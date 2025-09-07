// +++++ START OF FINAL, CORRECTED webrtc.ts +++++
import io, { Socket } from "socket.io-client";
import { SessionConfig } from "../types";

// The 'export' keyword was the missing piece.
export class WebRTCService {
  private socket: Socket;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private config: SessionConfig;

  public onRemoteStream?: (stream: MediaStream, peerId: string) => void;
  public onPeerDisconnected?: (peerId: string) => void;

  constructor(
    config: SessionConfig,
    localStream: MediaStream,
    signalingServerUrl?: string
  ) {
    this.config = config;
    this.localStream = localStream;

    // Dynamically determine signaling server URL
    // If no URL provided, use current host with port 3001
    const finalSignalingUrl =
      signalingServerUrl ||
      `${window.location.protocol}//${window.location.hostname}:3001`;

    console.log(
      `🔌 [WebRTC] Initializing WebRTC service for ${config.role} in session ${config.sessionId} (${config.mode} mode)`
    );
    console.log(
      `🔌 [WebRTC] Connecting to signaling server: ${finalSignalingUrl}`
    );
    console.log(`🔌 [WebRTC] Current window location: ${window.location.href}`);
    console.log(
      `🔌 [WebRTC] Local stream tracks:`,
      localStream?.getTracks().map((t) => `${t.kind}: ${t.enabled}`)
    );

    this.socket = io(finalSignalingUrl, {
      transports: ["websocket"],
      forceNew: true,
    });
  }

  public connect() {
    this.setupSocketListeners();
    this.socket.connect();
  }

  private setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log(
        `✅ [WebRTC] Connected to signaling server with ID: ${this.socket.id}`
      );
      this.joinSession();
    });

    this.socket.on("disconnect", (reason) => {
      console.log(
        `❌ [WebRTC] Disconnected from signaling server. Reason: ${reason}`
      );
    });

    this.socket.on("connect_error", (error) => {
      console.error(`🚨 [WebRTC] Connection error:`, error);
    });

    this.socket.on(
      "offer",
      async (data: {
        fromId: string;
        description: RTCSessionDescriptionInit;
      }) => {
        console.log(`📥 [WebRTC] Received offer from ${data.fromId}`);
        console.log(`📥 [WebRTC] Offer details:`, data.description);

        const peerConnection = this.getOrCreatePeerConnection(
          data.fromId,
          false
        ); // Do not create an offer back
        if (peerConnection.signalingState !== "stable") {
          console.warn(
            `⚠️ [WebRTC] Signaling state is not stable for offer from ${data.fromId}, ignoring. State: ${peerConnection.signalingState}`
          );
          return;
        }

        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.description)
          );
          console.log(`✅ [WebRTC] Set remote description for ${data.fromId}`);

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          console.log(`📤 [WebRTC] Sending answer to ${data.fromId}`);

          this.socket.emit("answer", {
            toId: data.fromId,
            description: peerConnection.localDescription,
          });
        } catch (error) {
          console.error(
            `🚨 [WebRTC] Error handling offer from ${data.fromId}:`,
            error
          );
        }
      }
    );

    this.socket.on(
      "answer",
      async (data: {
        fromId: string;
        description: RTCSessionDescriptionInit;
      }) => {
        console.log(`📥 [WebRTC] Received answer from ${data.fromId}`);
        console.log(`📥 [WebRTC] Answer details:`, data.description);

        const peerConnection = this.peerConnections.get(data.fromId);
        if (
          peerConnection &&
          peerConnection.signalingState === "have-local-offer"
        ) {
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(data.description)
            );
            console.log(
              `✅ [WebRTC] Set remote description (answer) for ${data.fromId}`
            );
          } catch (error) {
            console.error(
              `🚨 [WebRTC] Error setting remote description (answer) for ${data.fromId}:`,
              error
            );
          }
        } else {
          console.warn(
            `⚠️ [WebRTC] Cannot process answer from ${data.fromId}. Connection not found or wrong state.`
          );
        }
      }
    );

    this.socket.on("peer-joined", (peerId: string) => {
      console.log(`👋 [WebRTC] Peer ${peerId} joined the session`);
      console.log(
        `👋 [WebRTC] My role: ${this.config.role}, My ID: ${this.socket.id}`
      );

      if (
        this.config.role === "presenter" &&
        this.localStream &&
        peerId !== this.socket.id
      ) {
        console.log(
          `🎥 [WebRTC] I'm presenter with local stream, creating offer for new peer ${peerId}`
        );
        this.getOrCreatePeerConnection(peerId, true); // Force offer creation
      } else {
        console.log(
          `👀 [WebRTC] Not creating offer - Role: ${
            this.config.role
          }, Has stream: ${!!this.localStream}, Same peer: ${
            peerId === this.socket.id
          }`
        );
      }
    });

    this.socket.on("peer-left", (peerId: string) => {
      console.log(`👋 [WebRTC] Peer ${peerId} left the session`);
      this.removePeer(peerId);
    });

    this.socket.on(
      "ice-candidate",
      (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
        console.log(`🧊 [WebRTC] Received ICE candidate from ${data.fromId}`);
        const peerConnection = this.peerConnections.get(data.fromId);
        if (peerConnection) {
          peerConnection
            .addIceCandidate(new RTCIceCandidate(data.candidate))
            .then(() =>
              console.log(`✅ [WebRTC] Added ICE candidate from ${data.fromId}`)
            )
            .catch((e) =>
              console.error(
                `🚨 [WebRTC] Error adding ICE candidate from ${data.fromId}:`,
                e
              )
            );
        } else {
          console.warn(
            `⚠️ [WebRTC] Received ICE candidate from ${data.fromId} but no peer connection found`
          );
        }
      }
    );

    // Listen for session-related events
    this.socket.on("session-joined", (data: any) => {
      console.log(`🎯 [WebRTC] Successfully joined session:`, data);
    });

    this.socket.on("session-error", (error: any) => {
      console.error(`🚨 [WebRTC] Session error:`, error);
    });
  }

  private getOrCreatePeerConnection(
    peerId: string,
    shouldCreateOffer: boolean
  ): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      console.log(`🔄 [WebRTC] Reusing existing peer connection for ${peerId}`);
      return this.peerConnections.get(peerId)!;
    }

    console.log(
      `🆕 [WebRTC] Creating new peer connection for ${peerId}, shouldCreateOffer: ${shouldCreateOffer}`
    );

    const rtcConfig: RTCConfiguration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };
    const peerConnection = new RTCPeerConnection(rtcConfig);
    this.peerConnections.set(peerId, peerConnection);

    // Add local tracks if we're the presenter
    if (this.localStream && this.config.role === "presenter") {
      console.log(
        `🎥 [WebRTC] Adding ${
          this.localStream.getTracks().length
        } local tracks to peer connection for ${peerId}`
      );
      this.localStream.getTracks().forEach((track, index) => {
        console.log(
          `📹 [WebRTC] Adding track ${index}: ${track.kind} (enabled: ${track.enabled})`
        );
        peerConnection.addTrack(track, this.localStream!);
      });
    } else {
      console.log(
        `👀 [WebRTC] Not adding tracks - Role: ${
          this.config.role
        }, Has stream: ${!!this.localStream}`
      );
    }

    // Set up event handlers
    peerConnection.ontrack = (event) => {
      console.log(
        `🎬 [WebRTC] Received remote track from ${peerId}:`,
        event.track.kind
      );
      console.log(
        `🎬 [WebRTC] Remote stream has ${
          event.streams[0]?.getTracks().length || 0
        } tracks`
      );
      if (this.onRemoteStream && event.streams[0]) {
        this.onRemoteStream(event.streams[0], peerId);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 [WebRTC] Sending ICE candidate to ${peerId}`);
        this.socket.emit("ice-candidate", {
          toId: peerId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(
        `🔗 [WebRTC] Connection state changed for ${peerId}: ${peerConnection.connectionState}`
      );
      if (
        peerConnection.connectionState === "disconnected" ||
        peerConnection.connectionState === "failed"
      ) {
        console.log(
          `❌ [WebRTC] Removing peer ${peerId} due to connection failure`
        );
        this.removePeer(peerId);
      }
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log(
        `🧊 [WebRTC] ICE gathering state for ${peerId}: ${peerConnection.iceGatheringState}`
      );
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(
        `🧊 [WebRTC] ICE connection state for ${peerId}: ${peerConnection.iceConnectionState}`
      );
    };

    // Create offer if needed
    if (shouldCreateOffer && this.config.role === "presenter") {
      console.log(`📤 [WebRTC] Creating offer for ${peerId}`);
      peerConnection
        .createOffer()
        .then((offer) => {
          console.log(`✅ [WebRTC] Created offer for ${peerId}`, offer);
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          console.log(`📤 [WebRTC] Sending offer to ${peerId}`);
          this.socket.emit("offer", {
            toId: peerId,
            description: peerConnection.localDescription,
          });
        })
        .catch((error) => {
          console.error(
            `🚨 [WebRTC] Error creating/sending offer to ${peerId}:`,
            error
          );
        });
    }

    return peerConnection;
  }

  private joinSession() {
    console.log(
      `🎯 [WebRTC] Joining session ${this.config.sessionId} as ${this.config.role}`
    );
    this.socket.emit("join-session", {
      sessionId: this.config.sessionId,
      role: this.config.role,
    });
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
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    if (this.socket && this.socket.connected) this.socket.disconnect();
    console.log("Disconnected from WebRTC service");
  }
}
// +++++ END OF FINAL, CORRECTED webrtc.ts +++++
