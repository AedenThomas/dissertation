import React, { useState } from 'react';
import { SessionConfig } from '../types';

interface SessionSetupProps {
  onStartSession: (config: SessionConfig) => void;
}

export const SessionSetup: React.FC<SessionSetupProps> = ({ onStartSession }) => {
  const [sessionId, setSessionId] = useState('');
  const [mode, setMode] = useState<'p2p' | 'sfu'>('p2p');
  const [role, setRole] = useState<'presenter' | 'viewer'>('presenter');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionId.trim()) {
      alert('Please enter a session ID');
      return;
    }

    onStartSession({
      sessionId: sessionId.trim(),
      mode,
      role
    });
  };

  const generateSessionId = () => {
    const id = Math.random().toString(36).substring(2, 15);
    setSessionId(id);
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '50px auto', 
      padding: '20px', 
      border: '1px solid #ddd', 
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>
        Screen Sharing System
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Role:
          </label>
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value as 'presenter' | 'viewer')}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          >
            <option value="presenter">Presenter (Share Screen)</option>
            <option value="viewer">Viewer (Watch Screen)</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Architecture Mode:
          </label>
          <select 
            value={mode} 
            onChange={(e) => setMode(e.target.value as 'p2p' | 'sfu')}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          >
            <option value="p2p">Peer-to-Peer (P2P)</option>
            <option value="sfu">Selective Forwarding Unit (SFU)</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Session ID:
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Enter session ID"
              style={{ 
                flex: 1, 
                padding: '8px', 
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <button
              type="button"
              onClick={generateSessionId}
              style={{
                padding: '8px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Generate
            </button>
          </div>
        </div>

        <button
          type="submit"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '18px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {role === 'presenter' ? 'Start Sharing Session' : 'Join Session'}
        </button>
      </form>
      
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p><strong>Note:</strong> This system is configured for research evaluation purposes.</p>
        <p>Current mode: <strong>{mode.toUpperCase()}</strong></p>
      </div>
    </div>
  );
};