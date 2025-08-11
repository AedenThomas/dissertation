#!/usr/bin/env node

const TestRunner = require('./test-runner');
const config = require('./config');
const fs = require('fs-extra');
const os = require('os');
const networkController = require('./network-controller');
const Tesseract = require('tesseract.js'); // <-- ADD TESSERACT IMPORT

// A simple async lock to prevent race conditions
class Lock {
  constructor() { this._locked = false; this.queue = []; }
  acquire() {
    return new Promise(resolve => {
      if (!this._locked) { this._locked = true; resolve(); }
      else { this.queue.push(resolve); }
    });
  }
  release() {
    if (this.queue.length > 0) { this.queue.shift()(); }
    else { this._locked = false; }
  }
}

async function main() {
  console.log('WebRTC Screen Sharing Performance Evaluation Framework (True Parallel Mode)');
  console.log('========================================================================');

  // --- START OF NEW PRE-INITIALIZATION STEP ---
  console.log('Pre-initializing Tesseract.js OCR engine...');
  const scheduler = Tesseract.createScheduler();
  const worker = await Tesseract.createWorker();
  scheduler.addWorker(worker);
  await scheduler.terminate(); // We just needed it to download its files
  console.log('Tesseract.js is ready.');
  // --- END OF NEW PRE-INITIALIZATION STEP ---

  const numCPUs = os.cpus().length;
  const PARALLEL_JOBS = 10
  console.log(`Server has ${numCPUs} CPUs. Running up to ${PARALLEL_JOBS} parallel tests.`);

  // ... (the rest of the file is identical to the previous version) ...
  const allTestConfigs = [];
  for (const architecture of config.architectures) {
    for (const numViewers of config.numViewers) {
      for (const packetLoss of config.packetLossRates) {
        for (const bandwidth of config.bandwidthLimits) {
          allTestConfigs.push({ architecture, numViewers, packetLoss, bandwidth });
        }
      }
    }
  }

  console.log(`Total tests to run: ${allTestConfigs.length}`);
  await fs.ensureDir(config.resultsDir);
  
  const results = [];
  const queue = [...allTestConfigs];
  const networkLock = new Lock(); // This was missing in the previous simplified code, re-adding it.

  const workerFn = async (workerId) => { // Renamed from worker to avoid conflict
    while (queue.length > 0) {
      const testIndex = allTestConfigs.length - queue.length;
      const testConfig = queue.shift();
      if (!testConfig) continue;

      const testId = testIndex + 1;
      console.log(`[Worker ${workerId}] Starting Test ${testId}/${allTestConfigs.length}: ${JSON.stringify(testConfig)}`);
      
      let result;
      try {
        await networkController.apply(testConfig.packetLoss, testConfig.bandwidth);
        
        const testRunner = new TestRunner(testId, testConfig);
        result = await testRunner.run();
        
      } catch (e) {
        result = { ...testConfig, testId, success: false, error: e.message };
        console.error(`[Worker ${workerId}] Test ${testId} crashed:`, e.message);
      } finally {
        await networkController.clear();
      }
      results.push(result);
    }
  };

  const workerPromises = [];
  for (let i = 1; i <= PARALLEL_JOBS; i++) {
    workerPromises.push(workerFn(i));
  }
  
  await Promise.all(workerPromises);

  console.log('\n=== Test Suite Complete ===');
  
  const resultsFile = `${config.resultsDir}/results.json`;
  const csvFile = `${config.resultsDir}/results.csv`;
  await fs.writeJson(resultsFile, { metadata: { timestamp: Date.now(), totalTests: results.length, config }, results }, { spaces: 2 });
  const csvData = results.sort((a,b) => a.testId - b.testId).map(r => ({ testId: r.testId, architecture: r.architecture.toLowerCase(), numViewers: r.numViewers, packetLoss: r.packetLoss, bandwidth: r.bandwidth, success: r.success, avgLatency: r.metrics?.latency.average||0, minLatency: r.metrics?.latency.min||0, maxLatency: r.metrics?.latency.max||0, avgCpu: r.metrics?.cpu.average||0, maxCpu: r.metrics?.cpu.max||0, avgTls: r.metrics?.tls.average||1.0, minTls: r.metrics?.tls.min||1.0, timestamp: r.timestamp }));
  if (csvData.length > 0) {
    const csvHeader = Object.keys(csvData[0]).join(',') + '\n';
    const csvContent = csvData.map(row => Object.values(row).join(',')).join('\n');
    await fs.writeFile(csvFile, csvHeader + csvContent);
    console.log(`Results saved to ${resultsFile} and ${csvFile}`);
  }

  console.log(`\nSuccessful: ${results.filter(r => r.success).length} / ${results.length}`);
  process.exit(0);
}

main().catch(error => { console.error('Fatal error in test runner:', error); process.exit(1); });
// +++++ END OF FINAL, PRE-INITIALIZED index.js +++++