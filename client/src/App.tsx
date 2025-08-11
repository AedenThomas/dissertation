import React, { useState, useEffect } from 'react';
import { SessionSetup } from './components/SessionSetup';
import { ScreenShareSession } from './components/ScreenShareSession';
import { SessionConfig } from './types';

function App() {
  const [currentSession, setCurrentSession] = useState<SessionConfig | null>(null);

  // This is the new logic to auto-join from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');
    const role = params.get('role') as 'presenter' | 'viewer';
    const mode = params.get('mode') as 'p2p' | 'sfu';
    const autoStart = params.get('autoStart');

    if (sessionId && role && mode && autoStart === 'true') {
      console.log('Auto-starting session from URL parameters:', { sessionId, role, mode });
      setCurrentSession({ sessionId, role, mode });
    }
  }, []);

  const handleStartSession = (config: SessionConfig) => {
    setCurrentSession(config);
  };

  const handleLeaveSession = () => {
    // When leaving an auto-started session, clear the URL to show the setup screen again
    window.history.pushState({}, document.title, window.location.pathname);
    setCurrentSession(null);
  };

  return (
    <div className="App">
      {!currentSession ? (
        <SessionSetup onStartSession={handleStartSession} />
      ) : (
        <ScreenShareSession 
          config={currentSession} 
          onLeave={handleLeaveSession} 
        />
      )}
    </div>
  );
}

export default App;