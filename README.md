# Web-Based Screen Sharing System: P2P vs SFU Performance Evaluation

This repository contains a complete implementation of a web-based screen sharing system with automated testing framework for evaluating the performance differences between Peer-to-Peer (P2P) and Selective Forwarding Unit (SFU) architectures.

## 🎯 Project Overview

This system is designed for university environments where high text legibility for source code and documents is more important than high-frame-rate video. The implementation includes:

- **React TypeScript Client**: Single-page application with configurable P2P/SFU modes
- **Node.js Signaling Server**: WebRTC signaling coordination
- **Mediasoup SFU Server**: High-performance selective forwarding unit
- **Automated Test Framework**: Puppeteer-based performance evaluation
- **Data Analysis Pipeline**: Statistical analysis and visualization generation

## 📊 Key Performance Metrics

The system evaluates three critical metrics:

1. **Presenter CPU Utilization (%)**: Resource usage of the screen sharing presenter
2. **Glass-to-Glass (G2G) Latency (ms)**: End-to-end delay from capture to display
3. **Text Legibility Score (TLS)**: OCR-based quality measurement for text content

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Client   │    │ Signaling Server│    │   SFU Server    │
│  (TypeScript)   │◄──►│   (Node.js)     │◄──►│  (Mediasoup)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                        ▲                        ▲
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Test Framework  │    │ Data Analysis   │    │ Docker Compose  │
│  (Puppeteer)    │    │   (Python)      │    │ Orchestration   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ (required for all services)
- Python 3.9+ (for data analysis)
- Docker and Docker Compose (optional, local development recommended)

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd webrtc-screen-sharing-evaluation

# Install dependencies for all services
npm install                    # Root dependencies
cd signaling-server && npm install && cd ..
cd sfu-server && npm install && cd ..
cd client && npm install && cd ..
cd test-framework && npm install && cd ..
```

### 2. Start Development Environment (Local Mode - Recommended)

**Terminal 1: Start Signaling Server**
```bash
cd signaling-server
npm start
# Server will run on http://localhost:3001
```

**Terminal 2: Start SFU Server**
```bash
cd sfu-server  
npm start
# Server will run on http://localhost:3002
```

**Terminal 3: Start React Client**
```bash
cd client
npm start
# Application will open at http://localhost:3000
```

### 3. Test the System

1. Open your browser to `http://localhost:3000`
2. Select "Presenter (Share Screen)" role
3. Choose "Peer-to-Peer (P2P)" or "SFU" mode
4. Click "Generate" to create a session ID
5. Click "Start Sharing Session"
6. Grant browser screen sharing permission when prompted
7. On macOS: First allow browser permission, then select screen in system dialog

### 4. Add Viewers (Optional)

1. Open new browser tabs/windows to `http://localhost:3000`
2. Select "Viewer" role
3. Enter the same session ID from step 3 above
4. Click "Join Session" to view the shared screen

### 5. Run Automated Tests

```bash
cd test-framework
npm test
```

### 6. Generate Analysis Charts

```bash
cd data-analysis
pip install -r requirements.txt
python analyze.py
```

## 🐳 Docker Alternative (Optional)

If you prefer Docker (note: may have resource constraints):

```bash
# Start all services with Docker Compose
docker-compose -f docker/docker-compose.yml up --build

# Run tests
docker-compose -f docker/docker-compose.yml run test-framework npm test
```

## � Project Structure

```
.
├── client/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── services/      # WebRTC and metrics services
│   │   ├── hooks/         # Custom React hooks
│   │   └── types/         # TypeScript definitions
│   └── public/
│       └── test-content.html  # Ground truth content for TLS
│
├── signaling-server/       # WebRTC signaling coordination
│   └── src/
│       └── server.js      # Express + Socket.io server
│
├── sfu-server/            # Mediasoup SFU implementation
│   └── src/
│       ├── server.js      # Main SFU server
│       └── config.js      # Mediasoup configuration
│
├── test-framework/        # Automated testing infrastructure
│   ├── src/
│   │   ├── test-runner.js # Main test orchestration
│   │   ├── index.js       # Full test suite runner
│   │   └── single-test.js # Individual test runner
│   └── utils/
│       ├── metrics.js     # Performance measurement
│       └── network.js     # Network condition control
│
├── data-analysis/         # Statistical analysis and visualization
│   ├── analyze.py         # Main analysis script
│   ├── generate_sample_data.py  # Test data generator
│   └── requirements.txt   # Python dependencies
│
└── docker/               # Container orchestration
    ├── docker-compose.yml
    └── Dockerfile.*       # Individual service containers
```

## �🔬 Experimental Design

### Independent Variables

- **Architecture**: P2P, SFU
- **Number of Viewers**: 1, 2, 3, 4, 5, 8, 10, 15
- **Packet Loss Rate**: 0%, 1%, 2%, 5%, 10%
- **Presenter Upload Bandwidth**: 5 Mbps, 2 Mbps, 1 Mbps

### Test Execution Flow

1. **Network Setup**: Apply traffic control rules (`tc qdisc`)
2. **Browser Launch**: Create presenter + N viewer instances
3. **Session Initiation**: Start screen sharing with test content
4. **Measurement**: Collect metrics for 60 seconds
5. **Data Collection**: Save results to CSV/JSON
6. **Cleanup**: Reset network conditions and close browsers

### Performance Metrics

#### CPU Utilization
- Measured using `pidusage` library
- Tracks presenter browser process
- Sampled every 1 second

#### Glass-to-Glass Latency
- Timestamp encoding in presenter video pixels
- Decoding and measurement in viewer
- Sampled every 500ms

#### Text Legibility Score (TLS)
- Screenshots every 5 seconds
- OCR processing with Tesseract.js
- Levenshtein distance from ground truth
- Lower scores indicate better legibility

## 📈 Generated Visualizations

The system automatically generates three key charts:

### 1. `cpu_utilization.png`
- **Title**: Presenter CPU Utilization vs. Number of Viewers
- **X-axis**: Number of Viewers (1-15)
- **Y-axis**: CPU Utilization (%)
- **Conditions**: 0% packet loss
- **Comparison**: P2P vs SFU architectures

### 2. `latency_vs_loss.png`
- **Title**: Glass-to-Glass Latency vs. Packet Loss Rate
- **X-axis**: Packet Loss Rate (0-10%)
- **Y-axis**: G2G Latency (ms)
- **Conditions**: N=5 viewers
- **Comparison**: P2P vs SFU architectures

### 3. `tls_vs_bandwidth.png`
- **Title**: Text Legibility Score vs. Presenter Bandwidth
- **X-axis**: Bandwidth (1, 2, 5 Mbps)
- **Y-axis**: TLS (Levenshtein Distance)
- **Conditions**: N=5 viewers, 0% packet loss
- **Comparison**: P2P vs SFU architectures

## 🛠️ Development and Debugging

### Manual Testing

1. **Start Services**:
   ```bash
   # Terminal 1: Signaling Server
   cd signaling-server && npm start
   
   # Terminal 2: SFU Server  
   cd sfu-server && npm start
   
   # Terminal 3: Client
   cd client && npm start
   ```

2. **Test Session**:
   - Open `http://localhost:3000`
   - Create session as presenter with P2P mode
   - Open second browser tab as viewer
   - Join same session ID

### Single Test Execution

```bash
# Run specific test configuration
cd test-framework
npm run single-test P2P 3 0.02 2mbit

# Parameters: Architecture, Viewers, PacketLoss, Bandwidth
```

### Network Condition Testing

```bash
# Apply network conditions manually (requires sudo)
sudo tc qdisc add dev eth0 root netem loss 5% rate 1mbit

# Verify conditions
tc qdisc show dev eth0

# Remove conditions
sudo tc qdisc del dev eth0 root
```

### Monitoring

```bash
# Check service health
curl http://localhost:3001/health
curl http://localhost:3002/health

# View active sessions
curl http://localhost:3001/sessions
curl http://localhost:3002/sessions
```

## 📊 Data Analysis

### Result Files

- `results.json`: Complete test results with metadata
- `results.csv`: Flat format for easy analysis
- `summary_statistics.json`: Aggregated statistics
- `screenshots/`: TLS measurement screenshots

### Custom Analysis

```python
import pandas as pd
import matplotlib.pyplot as plt

# Load results
df = pd.read_csv('results/results.csv')

# Filter for specific conditions
p2p_data = df[df['architecture'] == 'P2P']
sfu_data = df[df['architecture'] == 'SFU']

# Custom visualization
plt.figure(figsize=(10, 6))
plt.scatter(p2p_data['numViewers'], p2p_data['avgLatency'], label='P2P', alpha=0.7)
plt.scatter(sfu_data['numViewers'], sfu_data['avgLatency'], label='SFU', alpha=0.7)
plt.xlabel('Number of Viewers')
plt.ylabel('Average Latency (ms)')
plt.legend()
plt.show()
```

## 🔧 Configuration

### Environment Variables

```bash
# Client configuration
REACT_APP_SIGNALING_SERVER_URL=http://localhost:3001
REACT_APP_SFU_SERVER_URL=http://localhost:3002

# SFU configuration
ANNOUNCED_IP=127.0.0.1
SFU_PORT=3002
SIGNALING_SERVER_URL=http://localhost:3001

# Test framework
CLIENT_URL=http://localhost:3000
TEST_DURATION=60
RESULTS_DIR=./results
```

### Test Parameters

Edit `test-framework/src/config.js`:

```javascript
module.exports = {
  architectures: ['P2P', 'SFU'],
  numViewers: [1, 2, 3, 4, 5, 8, 10, 15],
  packetLossRates: [0, 0.01, 0.02, 0.05, 0.10],
  bandwidthLimits: ['5mbit', '2mbit', '1mbit'],
  testDuration: 60000, // 60 seconds
  // ... other parameters
};
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "Permission denied" for network controls
```bash
# Run test framework with sudo access to tc command
sudo docker-compose -f docker/docker-compose.yml run test-framework npm test
```

#### 2. MediaSoup compilation errors
```bash
# Install build dependencies
apt-get update && apt-get install -y build-essential python3-dev
```

#### 3. Browser instances not closing
```bash
# Kill orphaned Chrome processes
pkill -f chrome
```

#### 4. Port conflicts
```bash
# Check occupied ports
netstat -tulpn | grep :3001
```

### Performance Optimization

#### 1. Increase test parallelization
- Modify `test-runner.js` to run multiple tests concurrently
- Be careful with resource usage and network interference

#### 2. Reduce screenshot processing time
- Lower screenshot resolution in `metrics.js`
- Use faster OCR settings in Tesseract configuration

#### 3. Network condition accuracy
- Use dedicated network namespaces for better isolation
- Consider hardware-based network emulation for more precise conditions

## 📚 Research Context

This implementation is designed to support research into WebRTC screen sharing performance, specifically comparing:

- **P2P Architecture**: Direct connections between presenter and each viewer
- **SFU Architecture**: Centralized forwarding without transcoding

The focus on text legibility makes this particularly suitable for:
- Educational video conferencing
- Code review sessions
- Document sharing in academic contexts
- Technical presentation scenarios

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Mediasoup**: High-performance SFU implementation
- **Puppeteer**: Automated browser testing
- **Tesseract.js**: OCR functionality for text legibility scoring
- **Socket.io**: Real-time communication infrastructure

---

**Note**: This system requires significant computational resources when running the complete test suite. Plan for extended execution times and ensure adequate system resources are available.
