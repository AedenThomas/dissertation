#!/usr/bin/env node

const TestRunner = require('./test-runner');
const fs = require('fs-extra');

async function main() {
  console.log('WebRTC Screen Sharing Performance Evaluation Framework');
  console.log('====================================================');

  const testRunner = new TestRunner();

  try {
    await testRunner.initialize();
    
    console.log('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const results = await testRunner.runAllTests();

    console.log('\n=== Final Summary ===');
    console.log(`Total tests completed: ${results.length}`);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);

    if (failed.length > 0) {
      console.log('\nFailed tests:');
      failed.forEach(test => {
        console.log(`  Test ${test.testId}: ${test.error || 'Unknown error'}`);
      });
    }

    console.log('\nTest execution complete!');
    process.exit(0);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;