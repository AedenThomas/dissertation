#!/usr/bin/env python3
"""
Simple visualization script using basic matplotlib
"""

import csv
import json
import os
from collections import defaultdict

# Try to import required packages, install if missing
try:
    import matplotlib
    matplotlib.use('Agg')  # Use non-interactive backend
    import matplotlib.pyplot as plt
    import numpy as np
except ImportError:
    print("Installing required packages...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--break-system-packages", "matplotlib", "numpy"])
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import numpy as np

def load_data():
    """Load test results from CSV file"""
    data = []
    csv_file = 'results/results.csv'
    
    if not os.path.exists(csv_file):
        print(f"Error: {csv_file} not found")
        return []
    
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert string values to appropriate types
            row['numViewers'] = int(row['numViewers'])
            row['packetLoss'] = float(row['packetLoss'])
            row['avgLatency'] = float(row['avgLatency'])
            row['avgCpu'] = float(row['avgCpu'])
            row['avgTls'] = float(row['avgTls'])
            data.append(row)
    
    print(f"Loaded {len(data)} test results")
    return data

def create_cpu_utilization_chart(data):
    """Generate CPU Utilization vs. Number of Viewers chart"""
    print("Creating CPU utilization chart...")
    
    # Filter for 0% packet loss
    filtered_data = [d for d in data if d['packetLoss'] == 0.0]
    
    # Group by architecture and number of viewers
    p2p_data = defaultdict(list)
    sfu_data = defaultdict(list)
    
    for item in filtered_data:
        viewers = item['numViewers']
        cpu = item['avgCpu']
        
        if item['architecture'].lower() == 'p2p':
            p2p_data[viewers].append(cpu)
        else:  # SFU
            sfu_data[viewers].append(cpu)
    
    # Calculate averages
    p2p_viewers = sorted(p2p_data.keys())
    p2p_cpu_avg = [np.mean(p2p_data[v]) for v in p2p_viewers]
    
    sfu_viewers = sorted(sfu_data.keys())
    sfu_cpu_avg = [np.mean(sfu_data[v]) for v in sfu_viewers]
    
    # Create plot
    plt.figure(figsize=(10, 6))
    plt.plot(p2p_viewers, p2p_cpu_avg, 'o-', linewidth=2, markersize=8, label='P2P Architecture', color='#1f77b4')
    plt.plot(sfu_viewers, sfu_cpu_avg, 's-', linewidth=2, markersize=8, label='SFU Architecture', color='#ff7f0e')
    
    plt.xlabel('Number of Viewers', fontsize=12)
    plt.ylabel('CPU Utilization (%)', fontsize=12)
    plt.title('Presenter CPU Utilization vs. Number of Viewers\\n(0% Packet Loss)', fontsize=14, fontweight='bold')
    plt.legend(fontsize=11)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    os.makedirs('results/visualizations', exist_ok=True)
    plt.savefig('results/visualizations/cpu_utilization.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("✅ CPU utilization chart saved")

def create_latency_vs_loss_chart(data):
    """Generate Latency vs. Packet Loss chart for N=5 viewers"""
    print("Creating latency vs packet loss chart...")
    
    # Filter for 5 viewers
    filtered_data = [d for d in data if d['numViewers'] == 5]
    
    # Group by architecture and packet loss
    p2p_data = defaultdict(list)
    sfu_data = defaultdict(list)
    
    for item in filtered_data:
        loss = item['packetLoss']
        latency = item['avgLatency']
        
        if item['architecture'].lower() == 'p2p':
            p2p_data[loss].append(latency)
        else:  # SFU
            sfu_data[loss].append(latency)
    
    # Calculate averages and convert packet loss to percentage
    p2p_losses = sorted(p2p_data.keys())
    p2p_losses_pct = [l * 100 for l in p2p_losses]
    p2p_latency_avg = [np.mean(p2p_data[l]) for l in p2p_losses]
    
    sfu_losses = sorted(sfu_data.keys())
    sfu_losses_pct = [l * 100 for l in sfu_losses]
    sfu_latency_avg = [np.mean(sfu_data[l]) for l in sfu_losses]
    
    # Create plot
    plt.figure(figsize=(10, 6))
    plt.plot(p2p_losses_pct, p2p_latency_avg, 'o-', linewidth=2, markersize=8, label='P2P Architecture', color='#1f77b4')
    plt.plot(sfu_losses_pct, sfu_latency_avg, 's-', linewidth=2, markersize=8, label='SFU Architecture', color='#ff7f0e')
    
    plt.xlabel('Packet Loss Rate (%)', fontsize=12)
    plt.ylabel('Glass-to-Glass Latency (ms)', fontsize=12)
    plt.title('Glass-to-Glass Latency vs. Packet Loss Rate\\n(N=5 viewers)', fontsize=14, fontweight='bold')
    plt.legend(fontsize=11)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    plt.savefig('results/visualizations/latency_vs_loss.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("✅ Latency vs packet loss chart saved")

def create_tls_vs_bandwidth_chart(data):
    """Generate TLS vs. Bandwidth chart"""
    print("Creating TLS vs bandwidth chart...")
    
    # Filter for 5 viewers and 0% packet loss
    filtered_data = [d for d in data if d['numViewers'] == 5 and d['packetLoss'] == 0.0]
    
    # Group by architecture and bandwidth
    p2p_data = defaultdict(list)
    sfu_data = defaultdict(list)
    
    for item in filtered_data:
        bandwidth = item['bandwidth']
        tls = item['avgTls']
        
        if item['architecture'].lower() == 'p2p':
            p2p_data[bandwidth].append(tls)
        else:  # SFU
            sfu_data[bandwidth].append(tls)
    
    # Define bandwidth order and labels
    bandwidth_order = ['1mbit', '2mbit', '5mbit']
    bandwidth_labels = ['1 Mbps', '2 Mbps', '5 Mbps']
    
    p2p_tls_avg = [np.mean(p2p_data[bw]) for bw in bandwidth_order]
    sfu_tls_avg = [np.mean(sfu_data[bw]) for bw in bandwidth_order]
    
    # Create bar chart
    x = np.arange(len(bandwidth_labels))
    width = 0.35
    
    plt.figure(figsize=(10, 6))
    plt.bar(x - width/2, p2p_tls_avg, width, label='P2P Architecture', alpha=0.8, color='#1f77b4')
    plt.bar(x + width/2, sfu_tls_avg, width, label='SFU Architecture', alpha=0.8, color='#ff7f0e')
    
    plt.xlabel('Presenter Bandwidth', fontsize=12)
    plt.ylabel('Text Legibility Score (Levenshtein Distance)', fontsize=12)
    plt.title('Text Legibility Score (TLS) vs. Presenter Bandwidth\\n(N=5 viewers, 0% packet loss)', fontsize=14, fontweight='bold')
    plt.xticks(x, bandwidth_labels)
    plt.legend(fontsize=11)
    plt.grid(True, alpha=0.3, axis='y')
    plt.tight_layout()
    
    plt.savefig('results/visualizations/tls_vs_bandwidth.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("✅ TLS vs bandwidth chart saved")

def create_summary_stats(data):
    """Generate summary statistics"""
    print("Creating summary statistics...")
    
    stats = {
        'total_tests': len(data),
        'architectures': ['P2P', 'SFU'],
        'performance_comparison': {}
    }
    
    # Calculate average performance by architecture
    for arch in ['P2P', 'SFU']:
        arch_data = [d for d in data if d['architecture'].lower() == arch.lower()]
        
        stats['performance_comparison'][arch] = {
            'avg_cpu': np.mean([d['avgCpu'] for d in arch_data]),
            'avg_latency': np.mean([d['avgLatency'] for d in arch_data]),
            'avg_tls': np.mean([d['avgTls'] for d in arch_data]),
            'test_count': len(arch_data)
        }
    
    # Save statistics
    with open('results/visualizations/summary_statistics.json', 'w') as f:
        json.dump(stats, f, indent=2)
    
    print("✅ Summary statistics saved")
    return stats

def main():
    print("WebRTC Screen Sharing Performance Analysis")
    print("=" * 50)
    
    # Load data
    data = load_data()
    if not data:
        print("No data found. Please run generate_fast_results.js first.")
        return
    
    # Create visualizations
    create_cpu_utilization_chart(data)
    create_latency_vs_loss_chart(data)
    create_tls_vs_bandwidth_chart(data)
    stats = create_summary_stats(data)
    
    print("\\n" + "=" * 50)
    print("📊 VISUALIZATION COMPLETE!")
    print("=" * 50)
    print(f"📈 Generated 3 research-grade visualizations")
    print(f"📁 Location: results/visualizations/")
    print(f"📋 Total tests analyzed: {stats['total_tests']}")
    
    print("\\n🖼️  Generated Images:")
    print("   • cpu_utilization.png - CPU usage vs viewer count")
    print("   • latency_vs_loss.png - Latency vs packet loss")  
    print("   • tls_vs_bandwidth.png - Text quality vs bandwidth")
    print("   • summary_statistics.json - Statistical summary")
    
    # Performance summary
    p2p_stats = stats['performance_comparison']['P2P']
    sfu_stats = stats['performance_comparison']['SFU']
    
    print(f"\\n📊 Performance Comparison:")
    print(f"   P2P: {p2p_stats['avg_cpu']:.1f}% CPU, {p2p_stats['avg_latency']:.1f}ms latency")
    print(f"   SFU: {sfu_stats['avg_cpu']:.1f}% CPU, {sfu_stats['avg_latency']:.1f}ms latency")

if __name__ == "__main__":
    main()