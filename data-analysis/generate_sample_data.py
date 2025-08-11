#!/usr/bin/env python3
"""
Generate sample test data for development and testing purposes
"""

import json
import csv
import random
import numpy as np
from pathlib import Path
import os

def generate_sample_results():
    """Generate realistic sample test results"""
    
    # Test parameters
    architectures = ['P2P', 'SFU']
    num_viewers = [1, 2, 3, 4, 5, 8, 10, 15]
    packet_loss_rates = [0, 0.01, 0.02, 0.05, 0.10]
    bandwidth_limits = ['5mbit', '2mbit', '1mbit']
    
    results = []
    test_id = 1
    
    for architecture in architectures:
        for viewers in num_viewers:
            for packet_loss in packet_loss_rates:
                for bandwidth in bandwidth_limits:
                    # Simulate realistic metrics based on conditions
                    
                    # CPU usage: P2P scales linearly with viewers, SFU is more constant
                    if architecture == 'P2P':
                        base_cpu = 15 + (viewers - 1) * 8
                        cpu_variation = random.uniform(0.8, 1.2)
                        avg_cpu = base_cpu * cpu_variation
                        max_cpu = avg_cpu * random.uniform(1.2, 1.5)
                    else:  # SFU
                        base_cpu = 25 + viewers * 2
                        cpu_variation = random.uniform(0.8, 1.2)
                        avg_cpu = base_cpu * cpu_variation
                        max_cpu = avg_cpu * random.uniform(1.1, 1.3)
                    
                    # Latency: affected by packet loss and architecture
                    base_latency = 50 if architecture == 'P2P' else 80
                    packet_loss_impact = packet_loss * 200  # ms increase per % loss
                    bandwidth_impact = {'5mbit': 0, '2mbit': 10, '1mbit': 25}[bandwidth]
                    viewer_impact = viewers * 2 if architecture == 'P2P' else viewers * 0.5
                    
                    avg_latency = base_latency + packet_loss_impact + bandwidth_impact + viewer_impact
                    avg_latency *= random.uniform(0.8, 1.2)
                    min_latency = avg_latency * random.uniform(0.6, 0.8)
                    max_latency = avg_latency * random.uniform(1.3, 1.8)
                    
                    # TLS: lower bandwidth = higher score (worse quality)
                    base_tls = {'5mbit': 0.05, '2mbit': 0.12, '1mbit': 0.25}[bandwidth]
                    packet_loss_impact = packet_loss * 0.3
                    architecture_impact = 0.02 if architecture == 'P2P' else 0.01
                    
                    avg_tls = base_tls + packet_loss_impact + architecture_impact
                    avg_tls *= random.uniform(0.7, 1.3)
                    min_tls = avg_tls * random.uniform(0.5, 0.8)
                    
                    # Create result record
                    result = {
                        'testId': test_id,
                        'architecture': architecture.lower(),
                        'numViewers': viewers,
                        'packetLoss': packet_loss,
                        'bandwidth': bandwidth,
                        'success': True,
                        'sessionId': f'test-{test_id}-sample',
                        'timestamp': 1700000000000 + test_id * 60000,
                        'completedAt': 1700000000000 + test_id * 60000 + 60000,
                        'metrics': {
                            'latency': {
                                'average': avg_latency,
                                'min': min_latency,
                                'max': max_latency,
                                'median': avg_latency * random.uniform(0.9, 1.1),
                                'count': random.randint(100, 120)
                            },
                            'cpu': {
                                'average': avg_cpu,
                                'min': avg_cpu * 0.3,
                                'max': max_cpu
                            },
                            'tls': {
                                'average': avg_tls,
                                'min': min_tls,
                                'max': avg_tls * random.uniform(1.2, 2.0)
                            }
                        }
                    }
                    
                    results.append(result)
                    test_id += 1
    
    return results

def save_sample_data(results_dir='./results'):
    """Save sample data in both JSON and CSV formats"""
    results_path = Path(results_dir)
    results_path.mkdir(exist_ok=True)
    
    # Generate sample results
    results = generate_sample_results()
    
    # Save JSON format
    json_data = {
        'metadata': {
            'timestamp': 1700000000000,
            'totalTests': len(results),
            'config': {
                'note': 'This is sample data generated for testing purposes'
            }
        },
        'results': results
    }
    
    json_file = results_path / 'results.json'
    with open(json_file, 'w') as f:
        json.dump(json_data, f, indent=2)
    
    # Save CSV format
    csv_data = []
    for result in results:
        csv_row = {
            'testId': result['testId'],
            'architecture': result['architecture'].upper(),
            'numViewers': result['numViewers'],
            'packetLoss': result['packetLoss'],
            'bandwidth': result['bandwidth'],
            'success': result['success'],
            'avgLatency': result['metrics']['latency']['average'],
            'minLatency': result['metrics']['latency']['min'],
            'maxLatency': result['metrics']['latency']['max'],
            'avgCpu': result['metrics']['cpu']['average'],
            'maxCpu': result['metrics']['cpu']['max'],
            'avgTls': result['metrics']['tls']['average'],
            'minTls': result['metrics']['tls']['min'],
            'timestamp': result['timestamp']
        }
        csv_data.append(csv_row)
    
    csv_file = results_path / 'results.csv'
    with open(csv_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_data[0].keys())
        writer.writeheader()
        writer.writerows(csv_data)
    
    print(f"Sample data generated:")
    print(f"  - {json_file}")
    print(f"  - {csv_file}")
    print(f"  - Total test results: {len(results)}")
    
    return results

if __name__ == "__main__":
    results_dir = os.environ.get('RESULTS_DIR', './results')
    save_sample_data(results_dir)