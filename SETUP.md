# Setup and Installation Guide

This guide provides detailed instructions for setting up the WebRTC Screen Sharing Evaluation System.

## System Requirements

### Hardware Requirements
- **CPU**: Multi-core processor (4+ cores recommended)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space for test results and logs
- **Network**: Stable internet connection for STUN/TURN servers

### Software Requirements
- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows with WSL2
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Node.js**: Version 16+ (for local development)
- **Python**: Version 3.9+ (for data analysis)

## Installation Methods

### Method 1: Docker Compose (Recommended)

This is the easiest method that requires minimal local setup.

```bash
# 1. Clone the repository
git clone <repository-url>
cd webrtc-screen-sharing-evaluation

# 2. Build all containers
docker-compose -f docker/docker-compose.yml build

# 3. Start all services
docker-compose -f docker/docker-compose.yml up -d

# 4. Verify services are running
docker-compose -f docker/docker-compose.yml ps
```

### Method 2: Local Development Setup

For development and debugging, you can run services locally.

#### Prerequisites Installation

**Ubuntu/Debian:**
```bash
# Install Node.js 16+
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3.9+
sudo apt-get install python3 python3-pip

# Install system dependencies
sudo apt-get install chromium-browser iproute2 net-tools
```

**macOS:**
```bash
# Install Node.js (using Homebrew)
brew install node@16

# Install Python
brew install python@3.9

# Install Chromium
brew install --cask chromium
```

**Windows (WSL2):**
```bash
# Follow Ubuntu instructions within WSL2
# Ensure Docker Desktop is configured for WSL2 integration
```

#### Service Setup

1. **Install Dependencies:**
   ```bash
   # Root level
   npm install
   
   # Client
   cd client && npm install && cd ..
   
   # Signaling Server
   cd signaling-server && npm install && cd ..
   
   # SFU Server
   cd sfu-server && npm install && cd ..
   
   # Test Framework
   cd test-framework && npm install && cd ..
   
   # Data Analysis
   cd data-analysis && pip install -r requirements.txt && cd ..
   ```

2. **Start Services in Separate Terminals:**
   ```bash
   # Terminal 1: Signaling Server
   cd signaling-server && npm start
   
   # Terminal 2: SFU Server
   cd sfu-server && npm start
   
   # Terminal 3: Client Development Server
   cd client && npm start
   ```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Client Configuration
REACT_APP_SIGNALING_SERVER_URL=http://localhost:3001
REACT_APP_SFU_SERVER_URL=http://localhost:3002

# SFU Server Configuration
ANNOUNCED_IP=127.0.0.1
SFU_PORT=3002
SIGNALING_SERVER_URL=http://localhost:3001

# Test Framework Configuration
CLIENT_URL=http://localhost:3000
SIGNALING_SERVER_URL=http://localhost:3001
SFU_SERVER_URL=http://localhost:3002
TEST_DURATION=60
RESULTS_DIR=./data-analysis/results

# Network Interface (adjust for your system)
NETWORK_INTERFACE=eth0
```

### Network Permissions

The test framework requires root privileges to control network conditions using Linux Traffic Control (`tc`):

```bash
# Option 1: Run entire Docker setup with sudo
sudo docker-compose -f docker/docker-compose.yml run test-framework npm test

# Option 2: Add user to sudoers for tc command (more secure)
echo "$USER ALL=(ALL) NOPASSWD: /sbin/tc" | sudo tee /etc/sudoers.d/tc-nopasswd
```

### Firewall Configuration

Ensure the following ports are available:

```bash
# Application ports
3000/tcp  # Client application
3001/tcp  # Signaling server
3002/tcp  # SFU server

# MediaSoup RTC ports
10000-10100/udp  # RTC media transport

# For cloud deployment, configure security groups/firewall rules accordingly
```

## Verification

### 1. Service Health Checks

```bash
# Check signaling server
curl http://localhost:3001/health

# Check SFU server  
curl http://localhost:3002/health

# Check client application
curl http://localhost:3000
```

Expected responses:
- Signaling server: `{"status":"ok","timestamp":...}`
- SFU server: `{"status":"ok","timestamp":...,"sessions":0,"routers":0}`
- Client: HTML page

### 2. Manual Functionality Test

1. Open browser to `http://localhost:3000`
2. Create a session as "Presenter" with P2P mode
3. Generate a session ID
4. Start sharing session
5. Open new tab/browser to same URL
6. Join as "Viewer" with same session ID
7. Verify video stream appears

### 3. Network Control Verification

```bash
# Test network control capabilities
sudo tc qdisc add dev lo root netem delay 100ms
sudo tc qdisc show dev lo
sudo tc qdisc del dev lo root

# Should show delay rule added and removed
```

## Running Tests

### Quick Test

Run a single test to verify everything works:

```bash
# Using Docker
docker-compose -f docker/docker-compose.yml run test-framework npm run single-test P2P 2 0 5mbit

# Using local setup
cd test-framework
sudo npm run single-test P2P 2 0 5mbit
```

### Full Test Suite

**Warning**: The full test suite takes significant time (6+ hours) and system resources.

```bash
# Using Docker (recommended)
docker-compose -f docker/docker-compose.yml run test-framework npm test

# Using local setup
cd test-framework
sudo npm test
```

Monitor progress:
```bash
# Watch test results being generated
watch -n 5 ls -la data-analysis/results/

# Monitor system resources
htop

# Check Docker container logs
docker-compose -f docker/docker-compose.yml logs -f test-framework
```

## Data Analysis

### Generate Sample Data (for testing)

```bash
# Create sample results for testing visualization
docker-compose -f docker/docker-compose.yml run data-analysis python generate_sample_data.py
```

### Analyze Results

```bash
# Generate all visualizations from test results
docker-compose -f docker/docker-compose.yml run data-analysis python analyze.py
```

### View Results

Generated files will be in `data-analysis/results/visualizations/`:
- `cpu_utilization.png`
- `latency_vs_loss.png`
- `tls_vs_bandwidth.png`
- `summary_statistics.json`

## Troubleshooting

### Docker Issues

#### "Permission denied" when accessing Docker
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and log back in
```

#### "No space left on device"
```bash
# Clean up Docker
docker system prune -a
docker volume prune
```

#### Port conflicts
```bash
# Find processes using ports
sudo netstat -tulpn | grep :3001
sudo lsof -i :3001

# Kill conflicting processes
sudo pkill -f node
```

### MediaSoup Issues

#### Compilation errors
```bash
# Install build dependencies
sudo apt-get update
sudo apt-get install build-essential python3-dev make g++
```

#### RTC connection failures
```bash
# Check firewall/network configuration
sudo ufw status
sudo iptables -L

# Verify MediaSoup worker processes
ps aux | grep mediasoup-worker
```

### Browser/Puppeteer Issues

#### Chromium not found
```bash
# Ubuntu
sudo apt-get install chromium-browser

# macOS  
brew install --cask chromium

# Or set custom path
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

#### "Chrome failed to start" in headless mode
```bash
# Add to Docker container or local environment
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 &
```

#### Screen capture permissions (macOS)
```bash
# Grant terminal/app screen recording permissions in:
# System Preferences > Security & Privacy > Privacy > Screen Recording
```

### Test Framework Issues

#### Network control not working
```bash
# Verify tc command availability
which tc
tc -help

# Check interface name
ip route | grep default
# Use the interface name in configuration
```

#### Tests timing out
```bash
# Increase timeouts in test-framework/src/config.js
testDuration: 120000,  // 2 minutes instead of 1
warmupTime: 10000,     // 10 seconds instead of 5
```

#### OCR accuracy issues
```bash
# Install better Tesseract models
sudo apt-get install tesseract-ocr-eng tesseract-ocr-script-latn

# Or adjust OCR settings in utils/metrics.js
```

### Performance Issues

#### High CPU usage
```bash
# Reduce concurrent tests
# Modify test-runner.js to run tests sequentially
# Add delays between tests
```

#### Memory leaks
```bash
# Monitor memory usage
watch -n 5 'free -h'

# Restart services periodically
docker-compose -f docker/docker-compose.yml restart
```

#### Slow test execution
```bash
# Reduce test parameters in config.js
numViewers: [1, 2, 3, 5],  # Fewer viewer counts
testDuration: 30000,       # Shorter test duration
```

## Cloud Deployment

### AWS Setup

```bash
# Launch EC2 instance (t3.large or larger recommended)
# Ubuntu 20.04 LTS AMI
# Configure security group for ports 3000-3002, 10000-10100

# Install Docker
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo usermod -aG docker ubuntu

# Clone and deploy
git clone <repository-url>
cd webrtc-screen-sharing-evaluation
docker-compose -f docker/docker-compose.yml up -d
```

### Environment-specific Configuration

#### Production
```bash
# Set production environment variables
NODE_ENV=production
ANNOUNCED_IP=<your-public-ip>
CLIENT_URL=http://<your-domain>:3000
```

#### Development
```bash
# Use localhost for development
ANNOUNCED_IP=127.0.0.1
CLIENT_URL=http://localhost:3000
```

## Maintenance

### Regular Tasks

```bash
# Clean up old results
find data-analysis/results -name "*.png" -mtime +7 -delete

# Rotate logs
docker-compose -f docker/docker-compose.yml logs --no-color > logs/$(date +%Y%m%d).log
docker-compose -f docker/docker-compose.yml logs --no-color --tail 0 -f

# Update dependencies
npm update
pip install --upgrade -r data-analysis/requirements.txt
```

### Backup

```bash
# Backup test results
tar -czf backup-$(date +%Y%m%d).tar.gz data-analysis/results/

# Backup configuration
cp .env .env.backup
```

## Support

For additional support:

1. Check the main [README.md](README.md) for architectural details
2. Review Docker logs: `docker-compose logs [service-name]`
3. Enable debug logging in individual services
4. Create GitHub issue with system info and error logs

### System Information Template

```bash
# Gather system information for support requests
echo "OS: $(uname -a)"
echo "Docker: $(docker --version)"
echo "Docker Compose: $(docker-compose --version)"
echo "Node.js: $(node --version)"
echo "Python: $(python3 --version)"
echo "Available Memory: $(free -h)"
echo "Available Disk: $(df -h)"
```