

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
  
  // Add refs to prevent multiple simultaneous requests
  const isRequestingPermission = useRef<boolean>(false);
  const startSharingCallCount = useRef<number>(0);
  const hasInitialized = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  console.log('🔄 [ScreenShare] useScreenSharing hook initialized/re-rendered for', config.role, 'in session', config.sessionId);

  const startSharing = useCallback(async () => {
    startSharingCallCount.current += 1;
    const callNumber = startSharingCallCount.current;
    console.log(`🔄 [ScreenShare] startSharing called (call #${callNumber}). isRequestingPermission: ${isRequestingPermission.current}, isSharing: ${isSharing}`);
    
    // Prevent multiple simultaneous permission requests
    if (isRequestingPermission.current) {
      console.log(`⏸️ [ScreenShare] Already requesting permission, ignoring call #${callNumber}`);
      return;
    }
    
    if (isSharing) {
      console.log(`⏸️ [ScreenShare] Already sharing, ignoring call #${callNumber}`);
      return;
    }
    
    isRequestingPermission.current = true;
    
    try {
      setError(null);
      console.log(`🎬 [ScreenShare] Starting screen sharing process (call #${callNumber})...`);
      
      // Add user instructions for macOS
      if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
        setError('Please grant screen sharing permission in the browser, then select your screen in the macOS dialog that follows.');
      }
      
      // Step 1: Get the local media stream with enhanced error handling
      console.log('🎬 [ScreenShare] Requesting screen access...');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          contentHint: 'detail',
          cursor: 'always'
        } as MediaTrackConstraints, 
        audio: false,
      });

      console.log('🎬 [ScreenShare] Screen access granted, stream obtained:', stream.getTracks().length, 'tracks');
      
      // Store the stream in ref to preserve it across re-renders
      localStreamRef.current = stream;
      
      // Clear any instruction messages
      setError(null);

      // Add event listener for when user stops sharing via browser controls
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('🎬 [ScreenShare] User stopped sharing via browser controls');
        localStreamRef.current = null;
        setIsSharing(false);
        setError('Screen sharing stopped by user');
      });

      // Always ensure local video ref gets the stream, even on re-renders
      if (localVideoRef.current) {
        console.log('🎬 [ScreenShare] Setting local video srcObject');
        localVideoRef.current.srcObject = stream;
      }
      
      // Step 2: NOW create the WebRTC service, passing the stream to it
      console.log('🎬 [ScreenShare] Creating WebRTC service...');
      const webrtcService = new WebRTCService(config, stream);
      webrtcServiceRef.current = webrtcService;
      
      // Step 3: Set up callbacks
      webrtcService.onRemoteStream = (remoteStream, peerId) => {
        console.log('🎬 [ScreenShare] Received remote stream from', peerId);
        setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream));
      };
      webrtcService.onPeerDisconnected = (peerId) => {
        console.log('🎬 [ScreenShare] Peer disconnected:', peerId);
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.delete(peerId);
          return updated;
        });
      };
      
      // Step 4: Connect to signaling and start WebRTC
      console.log('🎬 [ScreenShare] Connecting to signaling server...');
      webrtcService.connect();
      
      setIsSharing(true);
      setIsConnected(true);
      
      console.log('🎬 [ScreenShare] Screen sharing started successfully!');
    } catch (err) {
      console.error('🚨 [ScreenShare] Error starting screen sharing:', err);
      
      let errorMessage = 'Failed to start screen sharing';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Screen sharing permission denied. Please click "Allow" when prompted and select a screen to share.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No screens available for sharing.';
        } else if (err.name === 'AbortError') {
          errorMessage = 'Screen sharing was cancelled. Please try again and complete the screen selection.';
        } else if (err.name === 'NotSupportedError') {
          errorMessage = 'Screen sharing is not supported in this browser.';
        } else {
          errorMessage = `Screen sharing error: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      setIsSharing(false);
    } finally {
      isRequestingPermission.current = false;
      console.log(`🔄 [ScreenShare] Permission request completed for call #${callNumber}`);
    }
  }, [config]);
  
  // For viewers, we need a way to connect without a local stream
  const joinSessionAsViewer = useCallback(() => {
    // Pass a dummy stream for viewers.
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
    console.log(`🔄 [ScreenShare] useEffect triggered for role: ${config.role}, sessionId: ${config.sessionId}`);
    console.log(`🔄 [ScreenShare] Current state - isSharing: ${isSharing}, isConnected: ${isConnected}, hasInitialized: ${hasInitialized.current}`);
    
    // Prevent multiple initializations for the same session
    if (hasInitialized.current) {
      console.log(`⏸️ [ScreenShare] Already initialized, skipping useEffect execution`);
      return;
    }
    
    hasInitialized.current = true;
    console.log(`🔄 [ScreenShare] Initializing session for the first time`);
    
    metricsServiceRef.current = new MetricsService();
    
    // This effect now decides whether to start as presenter or viewer
    if (config.role === 'presenter') {
      console.log(`🎬 [ScreenShare] useEffect calling startSharing for presenter`);
      startSharing();
    } else {
      console.log(`👀 [ScreenShare] useEffect calling joinSessionAsViewer for viewer`);
      joinSessionAsViewer();
    }

    return () => {
      console.log(`🔄 [ScreenShare] useEffect cleanup - disconnecting services`);
      // Don't reset hasInitialized here to prevent re-initialization on re-renders
      // Only disconnect when component truly unmounts or session changes
      webrtcServiceRef.current?.disconnect();
      metricsServiceRef.current?.stopMonitoring();
    };
  }, [config.sessionId, config.role]);

  // Effect to ensure local video always has the stream (for presenter's preview)
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && config.role === 'presenter') {
      console.log('🎬 [ScreenShare] Ensuring local video has stream for presenter preview');
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }); // No dependencies - run on every render to ensure video is always connected
  
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
