import { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    const webrtcService = new WebRTCService(config);
    const metricsService = new MetricsService();
    
    webrtcServiceRef.current = webrtcService;
    metricsServiceRef.current = metricsService;

    webrtcService.onRemoteStream((stream, peerId) => {
      setRemoteStreams(prev => new Map(prev.set(peerId, stream)));
    });

    webrtcService.onPeerDisconnected((peerId) => {
      setRemoteStreams(prev => {
        const updated = new Map(prev);
        updated.delete(peerId);
        return updated;
      });
    });

    return () => {
      webrtcService.disconnect();
      metricsService.stopMonitoring();
    };
  }, [config]);

  const startSharing = async () => {
    try {
      setError(null);
      const webrtcService = webrtcServiceRef.current;
      const metricsService = metricsServiceRef.current;
      
      if (!webrtcService || !metricsService) return;

      const stream = await webrtcService.startScreenSharing();
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        metricsService.startLatencyMonitoring(
          localVideoRef.current as any,
          config.role === 'presenter'
        );
      }

      await webrtcService.joinSession();
      setIsSharing(true);
      setIsConnected(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start screen sharing';
      setError(errorMessage);
      console.error('Error starting screen sharing:', err);
    }
  };

  const stopSharing = () => {
    const webrtcService = webrtcServiceRef.current;
    const metricsService = metricsServiceRef.current;
    
    if (webrtcService) {
      webrtcService.stopScreenSharing();
    }
    
    if (metricsService) {
      metricsService.stopMonitoring();
    }
    
    setIsSharing(false);
    setIsConnected(false);
  };

  const joinSession = async () => {
    try {
      setError(null);
      const webrtcService = webrtcServiceRef.current;
      const metricsService = metricsServiceRef.current;
      
      if (!webrtcService || !metricsService) return;

      await webrtcService.joinSession();
      setIsConnected(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join session';
      setError(errorMessage);
      console.error('Error joining session:', err);
    }
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
    joinSession,
    getMetrics,
    localVideoRef
  };
};