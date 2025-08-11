const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class NetworkController {
  constructor() {
    this.currentRules = [];
  }

  async setNetworkConditions(packetLoss, bandwidth) {
    try {
      console.log(`Setting network conditions: ${packetLoss * 100}% loss, ${bandwidth} bandwidth`);
      
      await this.clearNetworkRules();
      
      const networkInterface = await this.getDefaultInterface();
      
      let command = `tc qdisc add dev ${networkInterface} root handle 1: netem`;
      
      if (packetLoss > 0) {
        command += ` loss ${packetLoss * 100}%`;
      }
      
      if (bandwidth !== 'unlimited') {
        command += ` rate ${bandwidth}`;
      }
      
      await execAsync(command);
      this.currentRules.push(networkInterface);
      
      console.log(`Network conditions applied successfully`);
      return true;
      
    } catch (error) {
      console.error('Error setting network conditions:', error);
      return false;
    }
  }

  async clearNetworkRules() {
    try {
      for (const networkInterface of this.currentRules) {
        try {
          await execAsync(`tc qdisc del dev ${networkInterface} root`);
        } catch (error) {
        }
      }
      this.currentRules = [];
      console.log('Network rules cleared');
    } catch (error) {
      console.error('Error clearing network rules:', error);
    }
  }

  async getDefaultInterface() {
    try {
      const { stdout } = await execAsync("ip route | grep default | awk '{print $5}' | head -n1");
      const networkInterface = stdout.trim();
      return networkInterface || 'eth0';
    } catch (error) {
      console.warn('Could not detect default interface, using eth0');
      return 'eth0';
    }
  }

  async verifyNetworkConditions() {
    try {
      const networkInterface = await this.getDefaultInterface();
      const { stdout } = await execAsync(`tc qdisc show dev ${networkInterface}`);
      return stdout.includes('netem');
    } catch (error) {
      return false;
    }
  }

  async measureBandwidth() {
    try {
      const { stdout } = await execAsync(`cat /proc/net/dev | grep eth0`);
      const parts = stdout.trim().split(/\s+/);
      return {
        rx_bytes: parseInt(parts[1]) || 0,
        tx_bytes: parseInt(parts[9]) || 0
      };
    } catch (error) {
      return { rx_bytes: 0, tx_bytes: 0 };
    }
  }
}

module.exports = NetworkController;