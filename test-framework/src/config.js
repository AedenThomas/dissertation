module.exports = {
  // Test parameters
  architectures: ['P2P', 'SFU'],        // 2 options
  numViewers: [1, 3, 5],       // 5 options (a good spread)
  packetLossRates: [0],                 // 1 option
  bandwidthLimits: ['5mbit'],           // 1 option   // <-- Reduced to ONE option
  
  // Test execution
  testDuration: 60000, // 60 seconds in milliseconds
  warmupTime: 5000,    // 5 seconds warmup
  cooldownTime: 3000,  // 3 seconds cooldown
  
  // Measurement intervals
  latencyMeasurementInterval: 500,  // Every 500ms
  screenshotInterval: 5000,        // Every 5 seconds
  cpuMeasurementInterval: 1000,    // Every 1 second
  
  // URLs
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  testContentUrl: process.env.CLIENT_URL || 'http://localhost:3000' + '/test-content.html',
  
  // Paths
  resultsDir: process.env.RESULTS_DIR || './results',
  screenshotsDir: process.env.RESULTS_DIR || './results' + '/screenshots',
  
  // Browser settings
  browserSettings: {
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps'
    ],
    defaultViewport: {
      width: 1280,
      height: 720
    },
    protocolTimeout: 60000
  },
  
  // Ground truth text for TLS calculation
  groundTruthText: `class WebRTCScreenSharingSystem {
    private peerConnections: Map<string, RTCPeerConnection>;
    private localStream: MediaStream | null = null;
    private signalingSocket: Socket;
    
    constructor(signalingServerUrl: string) {
        this.peerConnections = new Map();
        this.signalingSocket = io(signalingServerUrl);
        this.setupSignalingListeners();
    }
    
    async startScreenCapture(): Promise<void> {
        try {
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: { 
                    contentHint: 'detail',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });
            
            this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
                this.handleStreamEnded();
            });
            
        } catch (error) {
            console.error('Failed to capture screen:', error);
            throw error;
        }
    }`
};