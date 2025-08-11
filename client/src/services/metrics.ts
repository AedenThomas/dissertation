import { TimestampPixel, SessionMetrics } from '../types';

export class MetricsService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private latencyMeasurements: number[] = [];
  private isMonitoring: boolean = false;
  private timestampInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2;
    this.canvas.height = 2;
    this.ctx = this.canvas.getContext('2d')!;
  }

  startLatencyMonitoring(sourceElement: HTMLCanvasElement | HTMLVideoElement, isPresenter: boolean = false) {
    this.isMonitoring = true;
    
    if (isPresenter) {
      this.startTimestampGeneration(sourceElement as HTMLCanvasElement);
    } else {
      this.startLatencyMeasurement(sourceElement as HTMLVideoElement);
    }
  }

  private startTimestampGeneration(sourceCanvas: HTMLCanvasElement) {
    const ctx = sourceCanvas.getContext('2d')!;
    
    this.timestampInterval = setInterval(() => {
      const timestamp = Date.now();
      const pixel = this.encodeTimestamp(timestamp);
      
      ctx.fillStyle = `rgb(${pixel.x}, ${pixel.y}, ${timestamp & 0xFF})`;
      ctx.fillRect(0, 0, 2, 2);
    }, 500);
  }

  private startLatencyMeasurement(videoElement: HTMLVideoElement) {
    const checkLatency = () => {
      if (!this.isMonitoring) return;
      
      this.canvas.width = videoElement.videoWidth || 640;
      this.canvas.height = videoElement.videoHeight || 480;
      this.ctx.drawImage(videoElement, 0, 0);
      
      const imageData = this.ctx.getImageData(0, 0, 2, 2);
      const pixel = imageData.data;
      
      if (pixel.length >= 12) {
        const encodedTimestamp = this.decodeTimestamp({
          x: pixel[0],
          y: pixel[1],
          timestamp: pixel[2] + (pixel[4] << 8) + (pixel[8] << 16)
        });
        
        if (encodedTimestamp > 0) {
          const latency = Date.now() - encodedTimestamp;
          if (latency > 0 && latency < 5000) {
            this.latencyMeasurements.push(latency);
          }
        }
      }
      
      requestAnimationFrame(checkLatency);
    };
    
    checkLatency();
  }

  private encodeTimestamp(timestamp: number): TimestampPixel {
    return {
      x: (timestamp >> 16) & 0xFF,
      y: (timestamp >> 8) & 0xFF,
      timestamp: timestamp & 0xFF
    };
  }

  private decodeTimestamp(pixel: TimestampPixel): number {
    return (pixel.x << 16) | (pixel.y << 8) | pixel.timestamp;
  }

  getLatencyStats() {
    if (this.latencyMeasurements.length === 0) return { average: 0, min: 0, max: 0 };
    
    const sorted = this.latencyMeasurements.sort((a, b) => a - b);
    return {
      average: this.latencyMeasurements.reduce((a, b) => a + b, 0) / this.latencyMeasurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }

  stopMonitoring() {
    this.isMonitoring = false;
    if (this.timestampInterval) {
      clearInterval(this.timestampInterval);
      this.timestampInterval = null;
    }
  }

  reset() {
    this.latencyMeasurements = [];
    this.stopMonitoring();
  }

  async measureCpuUsage(): Promise<number> {
    if ('getProcessorInfo' in navigator) {
      try {
        const info = await (navigator as any).getProcessorInfo();
        return info.usage || 0;
      } catch (error) {
        console.warn('CPU usage measurement not available:', error);
      }
    }
    
    return 0;
  }

  exportMetrics(): SessionMetrics {
    const stats = this.getLatencyStats();
    return {
      latency: this.latencyMeasurements.slice(),
      cpuUsage: 0,
      timestamp: Date.now()
    };
  }
}