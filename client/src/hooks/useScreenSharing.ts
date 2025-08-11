// +++++ START OF FINAL, CORRECTED useScreenSharing.ts +++++
import { useState, useEffect, useRef, useCallback } from 'react';
import { WebRTCService } from '../services/webrtc';
import { MetricsService } from '../services/metrics';
import { SessionConfig } from '../types';

export const useScreenSharing = (config: SessionConfig) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [error, setError] = useState<string | null>(null);
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const metricsServiceRef = useRef<MetricsService | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const startSharing = useCallback(async () => {
    try {
      setError(null);
      // Step 1: Get the local media stream first
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { contentHint: 'detail' } as MediaTrackConstraints, // <-- THE FIX
        audio: false,
      });


      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Step 2: NOW create the WebRTC service, passing the stream to it
      const webrtcService = new WebRTCService(config, stream);
      webrtcServiceRef.current = webrtcService;
      
      // Step 3: Set up callbacks
      webrtcService.onRemoteStream = (remoteStream, peerId) => {
        setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream));
      };
      webrtcService.onPeerDisconnected = (peerId) => {
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.delete(peerId);
          return updated;
        });
      };
      
      // Step 4: Connect to signaling and start WebRTC
      webrtcService.connect();
      
      setIsSharing(true);
      setIsConnected(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start screen sharing';
      setError(errorMessage);
      console.error('Error starting screen sharing:', err);
    }
  }, [config]);
  
  // For viewers, we need a way to connect without a local stream
  const joinSessionAsViewer = useCallback(() => {
    // We pass a dummy stream for viewers, as they don't share
    // This satisfies the new constructor signature.
    const webrtcService = new WebRTCService(config, new MediaStream());
    webrtcServiceRef.current = webrtcService;

    webrtcService.onRemoteStream = (remoteStream, peerId) => {
        setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream));
    };
    webrtcService.onPeerDisconnected = (peerId) => {
        setRemoteStreams(prev => {
            const updated = new Map(prev);
            updated.delete(peerId);
            return updated;
        });
    };
    
    webrtcService.connect();
    setIsConnected(true);
  }, [config]);

  useEffect(() => {
    metricsServiceRef.current = new MetricsService();
    // This effect now decides whether to start as presenter or viewer
    if (config.role === 'presenter') {
      startSharing();
    } else {
      joinSessionAsViewer();
    }

    return () => {
      webrtcServiceRef.current?.disconnect();
      metricsServiceRef.current?.stopMonitoring();
    };
  }, [config, startSharing, joinSessionAsViewer]);
  
  const stopSharing = () => {
    webrtcServiceRef.current?.disconnect();
    if (metricsServiceRef.current) {
      metricsServiceRef.current.stopMonitoring();
    }
    setIsSharing(false);
    setIsConnected(false);
  };
  
  const getMetrics = () => {
    return metricsServiceRef.current?.exportMetrics() || null;
  };

  return {
    isSharing,
    isConnected,
    remoteStreams,
    error,
    startSharing,
    stopSharing,
    getMetrics,
    localVideoRef
  };
};
// +++++ END OF FINAL, CORRECTED useScreenSharing.ts +++++