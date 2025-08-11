// +++++ START OF REFACTORED test-runner.js +++++
const puppeteer = require('puppeteer');
const config = require('./config');
const MetricsCollector = require('../utils/metrics');

class TestRunner {
  constructor(testId, testConfig) {
    this.testId = testId;
    this.config = testConfig;
    this.metricsCollector = new MetricsCollector(config.groundTruthText);
  }

  async run() {
    const { architecture, numViewers } = this.config;
    console.log(`\t[Test ${this.testId}] EXECUTING: Arch=${architecture}, Viewers=${numViewers}...`);
    
    const browsers = [];
    const pages = [];
    let presenterBrowser = null;

    try {
      const sessionId = `test-${this.testId}-${Date.now()}`;
      const navigationTimeout = 120000; // Increase to 2 minutes for stability

      presenterBrowser = await puppeteer.launch(config.browserSettings);
      browsers.push(presenterBrowser);
      
      const presenterContentPage = await presenterBrowser.newPage();
      await presenterContentPage.goto(config.testContentUrl, { waitUntil: 'networkidle0', timeout: navigationTimeout });

      const presenterControlPage = await presenterBrowser.newPage();
      pages.push(presenterControlPage);
      const presenterUrl = `${config.clientUrl}?sessionId=${sessionId}&role=presenter&mode=${architecture}&autoStart=true`;
      await presenterControlPage.goto(presenterUrl, { waitUntil: 'networkidle0', timeout: navigationTimeout });

      for (let i = 0; i < numViewers; i++) {
        const viewerBrowser = await puppeteer.launch(config.browserSettings);
        browsers.push(viewerBrowser);
        const viewerPage = await viewerBrowser.newPage();
        pages.push(viewerPage);
        const viewerUrl = `${config.clientUrl}?sessionId=${sessionId}&role=viewer&mode=${architecture}&autoStart=true`;
        await viewerPage.goto(viewerUrl, { waitUntil: 'networkidle0', timeout: navigationTimeout });
      }
      
      console.log(`\t[Test ${this.testId}] Browsers connected, starting measurement.`);
      await new Promise(resolve => setTimeout(resolve, 15000)); // Longer wait for connections

      const measurementIntervals = [];
      measurementIntervals.push(setInterval(() => this.metricsCollector.measureCpuUsage(presenterBrowser.process()), config.cpuMeasurementInterval));
      measurementIntervals.push(setInterval(() => this.metricsCollector.captureLatencyMetrics(presenterContentPage, pages.slice(1)), config.latencyMeasurementInterval));
      measurementIntervals.push(setInterval(() => this.metricsCollector.captureScreenshotAndCalculateTLS(pages[0], this.testId), config.screenshotInterval));
      
      await new Promise(resolve => setTimeout(resolve, config.testDuration));
      measurementIntervals.forEach(clearInterval);

      console.log(`\t[Test ${this.testId}] Measurement finished.`);
      return { ...this.config, testId: this.testId, success: true, metrics: this.metricsCollector.exportResults(), timestamp: Date.now() };
    } finally {
      console.log(`\t[Test ${this.testId}] Cleaning up...`);
      for (const browser of browsers) {
        await browser.close().catch(() => {});
      }
    }
  }
}

module.exports = TestRunner;
// +++++ END OF REFACTORED test-runner.js +++++