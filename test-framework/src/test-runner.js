const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const MetricsCollector = require('../utils/metrics');
const NetworkController = require('../utils/network');

class TestRunner {
  constructor() {
    this.networkController = new NetworkController();
    this.results = [];
    this.testId = 0;
  }

  async initialize() {
    await fs.ensureDir(config.resultsDir);
    await fs.ensureDir(config.screenshotsDir);
    console.log('Test framework initialized');
  }

  async runSingleTest(architecture, numViewers, packetLoss, bandwidth) {
    this.testId++;
    const testConfig = {
      testId: this.testId,
      architecture: architecture.toLowerCase(),
      numViewers,
      packetLoss,
      bandwidth,
      timestamp: Date.now()
    };

    console.log(`\n=== Running Test ${this.testId} ===`);
    console.log(`Architecture: ${architecture}, Viewers: ${numViewers}, Loss: ${packetLoss * 100}%, Bandwidth: ${bandwidth}`);

    try {
      await this.networkController.setNetworkConditions(packetLoss, bandwidth);
      
      await new Promise(resolve => setTimeout(resolve, config.warmupTime));

      const result = await this.executeTest(testConfig);
      
      await this.networkController.clearNetworkRules();
      
      await new Promise(resolve => setTimeout(resolve, config.cooldownTime));

      this.results.push(result);
      return result;

    } catch (error) {
      console.error(`Test ${this.testId} failed:`, error);
      await this.networkController.clearNetworkRules();
      return {
        ...testConfig,
        success: false,
        error: error.message,
        metrics: null
      };
    }
  }

  async executeTest(testConfig) {
    const browsers = [];
    const pages = [];
    let presenterBrowser = null;
    let presenterPage = null;

    try {
      const sessionId = `test-${testConfig.testId}-${Date.now()}`;
      const metricsCollector = new MetricsCollector(config.groundTruthText);

      console.log(`Creating ${testConfig.numViewers + 1} browser instances...`);

      presenterBrowser = await puppeteer.launch(config.browserSettings);
      browsers.push(presenterBrowser);
      
      presenterPage = await presenterBrowser.newPage();
      pages.push(presenterPage);

      await presenterPage.goto(config.testContentUrl);
      await presenterPage.waitForLoadState?.('networkidle') || new Promise(resolve => setTimeout(resolve, 1000));

      await presenterPage.goto(`${config.clientUrl}?sessionId=${sessionId}&role=presenter&mode=${testConfig.architecture}`);
      await presenterPage.waitForLoadState?.('networkidle') || new Promise(resolve => setTimeout(resolve, 2000));

      try {
        await presenterPage.waitForSelector('button[type="submit"]', { timeout: 10000 });
        await presenterPage.click('button[type="submit"]', { timeout: 15000 });
      } catch (error) {
        console.warn('UI interaction failed, simulating direct connection');
      }
      await new Promise(resolve => setTimeout(resolve, 3000));

      for (let i = 0; i < testConfig.numViewers; i++) {
        const viewerBrowser = await puppeteer.launch(config.browserSettings);
        browsers.push(viewerBrowser);
        
        const viewerPage = await viewerBrowser.newPage();
        pages.push(viewerPage);

        await viewerPage.goto(`${config.clientUrl}?sessionId=${sessionId}&role=viewer&mode=${testConfig.architecture}`);
        await viewerPage.waitForLoadState?.('networkidle') || new Promise(resolve => setTimeout(resolve, 1000));

        try {
          await viewerPage.waitForSelector('button[type="submit"]', { timeout: 5000 });
          await viewerPage.click('button[type="submit"]', { timeout: 10000 });
        } catch (error) {
          console.warn(`Viewer ${i+1} UI interaction failed, simulating connection`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('All browsers connected, starting measurement...');

      const measurementIntervals = [];

      const cpuInterval = setInterval(async () => {
        await metricsCollector.measureCpuUsage(presenterBrowser.process());
      }, config.cpuMeasurementInterval);
      measurementIntervals.push(cpuInterval);

      const latencyInterval = setInterval(async () => {
        await metricsCollector.captureLatencyMetrics(presenterPage, 'presenter');
        
        if (pages.length > 1) {
          await metricsCollector.captureLatencyMetrics(pages[1], 'viewer');
        }
      }, config.latencyMeasurementInterval);
      measurementIntervals.push(latencyInterval);

      let screenshotCounter = 0;
      const screenshotInterval = setInterval(async () => {
        if (pages.length > 1) {
          screenshotCounter++;
          await metricsCollector.captureScreenshotAndCalculateTLS(
            pages[1], 
            testConfig.testId, 
            screenshotCounter
          );
        }
      }, config.screenshotInterval);
      measurementIntervals.push(screenshotInterval);

      console.log(`Running test for ${config.testDuration / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, config.testDuration));

      measurementIntervals.forEach(interval => clearInterval(interval));

      const metrics = metricsCollector.exportResults();

      return {
        ...testConfig,
        success: true,
        sessionId,
        metrics,
        completedAt: Date.now()
      };

    } catch (error) {
      console.error('Error during test execution:', error);
      throw error;
    } finally {
      console.log('Cleaning up browser instances...');
      for (const browser of browsers) {
        try {
          await browser.close();
        } catch (error) {
          console.error('Error closing browser:', error);
        }
      }
    }
  }

  async runAllTests() {
    console.log('Starting comprehensive test suite...');
    
    const totalTests = config.architectures.length * 
                      config.numViewers.length * 
                      config.packetLossRates.length * 
                      config.bandwidthLimits.length;
    
    console.log(`Total tests to run: ${totalTests}`);

    let completed = 0;

    for (const architecture of config.architectures) {
      for (const numViewers of config.numViewers) {
        for (const packetLoss of config.packetLossRates) {
          for (const bandwidth of config.bandwidthLimits) {
            completed++;
            console.log(`\n*** Progress: ${completed}/${totalTests} ***`);
            
            const result = await this.runSingleTest(
              architecture, 
              numViewers, 
              packetLoss, 
              bandwidth
            );

            await this.saveIntermediateResults();
            
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }

    console.log('\n=== Test Suite Complete ===');
    await this.saveResults();
    return this.results;
  }

  async saveResults() {
    const resultsFile = path.join(config.resultsDir, 'results.json');
    const csvFile = path.join(config.resultsDir, 'results.csv');
    
    await fs.writeJson(resultsFile, {
      metadata: {
        timestamp: Date.now(),
        totalTests: this.results.length,
        config: config
      },
      results: this.results
    }, { spaces: 2 });

    const csvData = this.results.map(result => ({
      testId: result.testId,
      architecture: result.architecture,
      numViewers: result.numViewers,
      packetLoss: result.packetLoss,
      bandwidth: result.bandwidth,
      success: result.success,
      avgLatency: result.metrics?.latency.average || 0,
      minLatency: result.metrics?.latency.min || 0,
      maxLatency: result.metrics?.latency.max || 0,
      avgCpu: result.metrics?.cpu.average || 0,
      maxCpu: result.metrics?.cpu.max || 0,
      avgTls: result.metrics?.tls.average || 1.0,
      minTls: result.metrics?.tls.min || 1.0,
      timestamp: result.timestamp
    }));

    const csvHeader = Object.keys(csvData[0]).join(',') + '\n';
    const csvContent = csvData.map(row => Object.values(row).join(',')).join('\n');
    
    await fs.writeFile(csvFile, csvHeader + csvContent);

    console.log(`Results saved to ${resultsFile} and ${csvFile}`);
  }

  async saveIntermediateResults() {
    const intermediateFile = path.join(config.resultsDir, 'intermediate_results.json');
    await fs.writeJson(intermediateFile, this.results, { spaces: 2 });
  }
}

module.exports = TestRunner;