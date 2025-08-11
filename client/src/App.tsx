import React, { useState } from 'react';
import { SessionSetup } from './components/SessionSetup';
import { ScreenShareSession } from './components/ScreenShareSession';
import { SessionConfig } from './types';

function App() {
  const [currentSession, setCurrentSession] = useState<SessionConfig | null>(null);

  const handleStartSession = (config: SessionConfig) => {
    setCurrentSession(config);
  };

  const handleLeaveSession = () => {
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