import React, { useEffect, useRef } from 'react';
import { SessionConfig } from '../types';
import { useScreenSharing } from '../hooks/useScreenSharing';

interface ScreenShareSessionProps {
  config: SessionConfig;
  onLeave: () => void;
}

export const ScreenShareSession: React.FC<ScreenShareSessionProps> = ({ 
  config, 
  onLeave 
}) => {
  const {
    isSharing,
    isConnected,
    remoteStreams,
    error,
    startSharing,
    stopSharing,
    // joinSession,
    getMetrics,
    localVideoRef
  } = useScreenSharing(config);

  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (config.role === 'presenter') {
      startSharing();
    } else {
      // joinSession();
    }
  }, []);

  useEffect(() => {
    remoteStreams.forEach((stream, peerId) => {
      const videoElement = remoteVideoRefs.current.get(peerId);
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const handleLeave = () => {
    stopSharing();
    onLeave();
  };

  const logMetrics = () => {
    const metrics = getMetrics();
    console.log('Session Metrics:', metrics);
  };

  if (error) {
    return (
      <div style={{ 
        maxWidth: '600px', 
        margin: '50px auto', 
        padding: '20px', 
        textAlign: 'center' 
      }}>
        <h2 style={{ color: 'red' }}>Error</h2>
        <p>{error}</p>
        <button 
          onClick={onLeave}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Back to Setup
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px',
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px'
      }}>
        <div>
          <h2>Session: {config.sessionId}</h2>
          <p>
            Mode: <strong>{config.mode.toUpperCase()}</strong> | 
            Role: <strong>{config.role}</strong> | 
            Status: <strong style={{ color: isConnected ? 'green' : 'red' }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={logMetrics}
            style={{
              padding: '8px 16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Log Metrics
          </button>
          <button 
            onClick={handleLeave}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Leave Session
          </button>
        </div>
      </div>

      {config.role === 'presenter' && (
        <div style={{ marginBottom: '30px' }}>
          <h3>Your Screen (Presenter View)</h3>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            style={{ 
              width: '100%', 
              maxWidth: '800px',
              border: '2px solid #007bff',
              borderRadius: '4px'
            }}
          />
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            Sharing: {isSharing ? 'Active' : 'Inactive'}
          </p>
        </div>
      )}

      {config.role === 'viewer' && remoteStreams.size === 0 && isConnected && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px'
        }}>
          <h3>Waiting for presenter...</h3>
          <p>No screen sharing detected yet.</p>
        </div>
      )}

      {remoteStreams.size > 0 && (
        <div>
          <h3>Remote Screens ({remoteStreams.size} viewer{remoteStreams.size > 1 ? 's' : ''})</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '20px'
          }}>
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
              <div key={peerId} style={{ position: 'relative' }}>
                <video
                  ref={(el) => {
                    if (el) {
                      remoteVideoRefs.current.set(peerId, el);
                      el.srcObject = stream;
                    }
                  }}
                  autoPlay
                  style={{ 
                    width: '100%',
                    border: '2px solid #28a745',
                    borderRadius: '4px'
                  }}
                />
                <div style={{ 
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  Peer: {peerId.substring(0, 8)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};