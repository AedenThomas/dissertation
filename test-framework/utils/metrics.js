const config = require('../src/config');
const fs = require('fs-extra');
const path = require('path');
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

  async captureLatencyMetrics(presenterContentPage, viewerPages) {
    try {
      await presenterContentPage.evaluate(() => {
        const pixel = document.getElementById('latency-pixel');
        if (pixel) {
          const timestamp = Date.now();
          const r = (timestamp >> 16) & 0xFF; const g = (timestamp >> 8) & 0xFF; const b = timestamp & 0xFF;
          pixel.style.backgroundColor = `rgb(${r},${g},${b})`;
        }
      });

      if (viewerPages.length > 0) {
        const viewerPage = viewerPages[0];
        const metrics = await viewerPage.evaluate(() => {
          const video = document.querySelector('video');
          if (!video || video.readyState < video.HAVE_METADATA || video.videoWidth === 0) return { latency: null };

          const canvas = document.createElement('canvas');
          canvas.width = 4; canvas.height = 4;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, 4, 4);
          const imageData = ctx.getImageData(0, 0, 1, 1).data;
          
          const r = imageData[0]; const g = imageData[1]; const b = imageData[2];
          const decodedTimestamp = (r << 16) | (g << 8) | b;
          const now = Date.now();
          
          if (decodedTimestamp > now - 15000 && decodedTimestamp <= now) {
            return { latency: now - decodedTimestamp };
          }
          return { latency: null };
        }).catch(() => ({ latency: null }));
        
        if (metrics && metrics.latency !== null) {
          this.latencyMeasurements.push({ timestamp: Date.now(), latency: metrics.latency });
        }
      }
    } catch (error) {
      // Fail silently
    }
  }



  async captureScreenshotAndCalculateTLS(page, testId, screenshotIndex) {
    try {
      const screenshotPath = `${config.screenshotsDir}/test_${testId}_${screenshotIndex}.png`;
      
      // Ensure the directory exists before trying to save the file. This is the fix.
      await fs.ensureDir(path.dirname(screenshotPath));

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