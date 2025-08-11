const pidusage = require('pidusage');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const levenshtein = require('levenshtein');

class MetricsCollector {
  constructor(groundTruthText) {
    this.groundTruthText = groundTruthText;
    this.latencyMeasurements = [];
    this.cpuMeasurements = [];
    this.screenshotResults = [];
  }

  async measureCpuUsage(browserProcess) {
    try {
      const stats = await pidusage(browserProcess.pid);
      const cpuPercent = stats.cpu;
      this.cpuMeasurements.push({
        timestamp: Date.now(),
        cpu: cpuPercent
      });
      return cpuPercent;
    } catch (error) {
      console.error('Error measuring CPU usage:', error);
      return 0;
    }
  }

  async captureLatencyMetrics(page, role) {
    try {
      const metrics = await page.evaluate((role) => {
        if (role === 'presenter') {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const timestamp = Date.now();
          
          const r = (timestamp >> 16) & 0xFF;
          const g = (timestamp >> 8) & 0xFF;
          const b = timestamp & 0xFF;
          
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(0, 0, 2, 2);
          
          return { action: 'timestamp_encoded', timestamp };
        } else {
          const videos = document.querySelectorAll('video');
          if (videos.length === 0) return { latency: null };
          
          const video = videos[0];
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, 2, 2);
          const pixel = imageData.data;
          
          if (pixel.length >= 12) {
            const timestamp = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
            const latency = Date.now() - timestamp;
            
            if (latency > 0 && latency < 5000) {
              return { latency };
            }
          }
          
          return { latency: null };
        }
      }, role);
      
      if (metrics.latency !== null && metrics.latency !== undefined) {
        this.latencyMeasurements.push({
          timestamp: Date.now(),
          latency: metrics.latency
        });
      }
      
      return metrics;
    } catch (error) {
      console.error('Error capturing latency metrics:', error);
      return { latency: null };
    }
  }

  async captureScreenshotAndCalculateTLS(page, testId, screenshotIndex) {
    try {
      const screenshotPath = `${process.env.RESULTS_DIR || './results'}/screenshots/test_${testId}_${screenshotIndex}.png`;
      
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: 800,
          height: 600
        }
      });

      const image = await Jimp.read(screenshotPath);
      const processedImage = await image
        .greyscale()
        .contrast(0.5)
        .getBufferAsync(Jimp.MIME_PNG);

      const { data: { text } } = await Tesseract.recognize(processedImage, 'eng', {
        logger: () => {} // Suppress Tesseract logs
      });

      const cleanText = text.replace(/\s+/g, ' ').trim();
      const cleanGroundTruth = this.groundTruthText.replace(/\s+/g, ' ').trim();
      
      const distance = levenshtein(cleanText, cleanGroundTruth);
      
      const tlsScore = distance / Math.max(cleanText.length, cleanGroundTruth.length);
      
      this.screenshotResults.push({
        timestamp: Date.now(),
        screenshotPath: screenshotPath,
        recognizedText: cleanText,
        tlsScore: tlsScore,
        levenshteinDistance: distance
      });

      console.log(`TLS Score: ${tlsScore.toFixed(4)}, Distance: ${distance}`);
      return tlsScore;
      
    } catch (error) {
      console.error('Error calculating TLS:', error);
      return 1.0;
    }
  }

  getLatencyStats() {
    if (this.latencyMeasurements.length === 0) {
      return { average: 0, min: 0, max: 0, median: 0 };
    }

    const latencies = this.latencyMeasurements.map(m => m.latency);
    latencies.sort((a, b) => a - b);

    return {
      average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      min: latencies[0],
      max: latencies[latencies.length - 1],
      median: latencies[Math.floor(latencies.length / 2)],
      count: latencies.length
    };
  }

  getCpuStats() {
    if (this.cpuMeasurements.length === 0) {
      return { average: 0, min: 0, max: 0 };
    }

    const cpuValues = this.cpuMeasurements.map(m => m.cpu);
    return {
      average: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
      min: Math.min(...cpuValues),
      max: Math.max(...cpuValues)
    };
  }

  getTlsStats() {
    if (this.screenshotResults.length === 0) {
      return { average: 1.0, min: 1.0, max: 1.0 };
    }

    const tlsScores = this.screenshotResults.map(r => r.tlsScore);
    return {
      average: tlsScores.reduce((a, b) => a + b, 0) / tlsScores.length,
      min: Math.min(...tlsScores),
      max: Math.max(...tlsScores)
    };
  }

  exportResults() {
    return {
      latency: this.getLatencyStats(),
      cpu: this.getCpuStats(),
      tls: this.getTlsStats(),
      rawData: {
        latencyMeasurements: this.latencyMeasurements,
        cpuMeasurements: this.cpuMeasurements,
        screenshotResults: this.screenshotResults
      }
    };
  }

  reset() {
    this.latencyMeasurements = [];
    this.cpuMeasurements = [];
    this.screenshotResults = [];
  }
}

module.exports = MetricsCollector;