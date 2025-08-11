#!/usr/bin/env node

const TestRunner = require('./test-runner');

async function runSingleTest() {
  console.log('Running single test for debugging...');

  const architecture = process.argv[2] || 'P2P';
  const numViewers = parseInt(process.argv[3]) || 2;
  const packetLoss = parseFloat(process.argv[4]) || 0;
  const bandwidth = process.argv[5] || '5mbit';

  console.log(`Test parameters:
    Architecture: ${architecture}
    Viewers: ${numViewers}
    Packet Loss: ${packetLoss * 100}%
    Bandwidth: ${bandwidth}`);

  const testRunner = new TestRunner();

  try {
    await testRunner.initialize();
    
    console.log('Waiting for services...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const result = await testRunner.runSingleTest(architecture, numViewers, packetLoss, bandwidth);

    console.log('\n=== Test Result ===');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.metrics) {
      console.log('\n=== Metrics Summary ===');
      console.log(`CPU Usage: ${result.metrics.cpu.average.toFixed(2)}% (avg), ${result.metrics.cpu.max.toFixed(2)}% (max)`);
      console.log(`Latency: ${result.metrics.latency.average.toFixed(2)}ms (avg), ${result.metrics.latency.min}-${result.metrics.latency.max}ms (range)`);
      console.log(`Text Legibility Score: ${result.metrics.tls.average.toFixed(4)} (avg)`);
    }

    await testRunner.saveResults();
    console.log('\nSingle test complete!');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runSingleTest();
}