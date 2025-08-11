// +++++ START OF NEW network-controller.js +++++
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// A simple async lock
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

class NetworkController {
  constructor() {
    this.lock = new Lock();
    this.interface = 'eth0'; // Assuming eth0, can be detected
  }

  async apply(packetLoss, bandwidth) {
    await this.lock.acquire();
    try {
      // Clear any previous rule first
      await execAsync(`tc qdisc del dev ${this.interface} root`).catch(() => {}); // Ignore error if no rule exists
      
      if (packetLoss > 0 || bandwidth) {
        let command = `tc qdisc add dev ${this.interface} root handle 1: netem`;
        if (packetLoss > 0) command += ` loss ${packetLoss * 100}%`;
        if (bandwidth) command += ` rate ${bandwidth}`;
        await execAsync(command);
      }
    } finally {
      this.lock.release();
    }
  }

  async clear() {
    await this.lock.acquire();
    try {
      await execAsync(`tc qdisc del dev ${this.interface} root`).catch(() => {}); // Ignore error if no rule exists
    } finally {
      this.lock.release();
    }
  }
}

// Export a single, shared instance for all tests to use
module.exports = new NetworkController();
// +++++ END OF NEW network-controller.js +++++