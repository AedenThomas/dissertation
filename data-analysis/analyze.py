#!/usr/bin/env python3
"""
Data Analysis and Visualization Script for WebRTC Screen Sharing Evaluation
Generates the required visualizations: cpu_utilization.png, latency_vs_loss.png, tls_vs_bandwidth.png
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import json
import os
from pathlib import Path

class DataAnalyzer:
    def __init__(self, results_dir='./results'):
        self.results_dir = Path(results_dir)
        self.data = None
        
        # Set up plotting style
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        
        # Create output directory
        self.output_dir = self.results_dir / 'visualizations'
        self.output_dir.mkdir(exist_ok=True)
    
    def load_data(self):
        """Load test results from JSON and CSV files"""
        print("Loading test results...")
        
        json_file = self.results_dir / 'results.json'
        csv_file = self.results_dir / 'results.csv'
        
        if csv_file.exists():
            print(f"Loading CSV data from {csv_file}")
            self.data = pd.read_csv(csv_file)
        elif json_file.exists():
            print(f"Loading JSON data from {json_file}")
            with open(json_file, 'r') as f:
                json_data = json.load(f)
            
            # Convert JSON to DataFrame
            results = json_data['results']
            records = []
            
            for result in results:
                if result.get('success', False) and result.get('metrics'):
                    record = {
                        'testId': result['testId'],
                        'architecture': result['architecture'].upper(),
                        'numViewers': result['numViewers'],
                        'packetLoss': result['packetLoss'],
                        'bandwidth': result['bandwidth'],
                        'avgLatency': result['metrics']['latency']['average'],
                        'minLatency': result['metrics']['latency']['min'],
                        'maxLatency': result['metrics']['latency']['max'],
                        'avgCpu': result['metrics']['cpu']['average'],
                        'maxCpu': result['metrics']['cpu']['max'],
                        'avgTls': result['metrics']['tls']['average'],
                        'minTls': result['metrics']['tls']['min']
                    }
                    records.append(record)
            
            self.data = pd.DataFrame(records)
        else:
            raise FileNotFoundError("No results.json or results.csv found in results directory")
        
        print(f"Loaded {len(self.data)} test results")
        print(f"Architectures: {self.data['architecture'].unique()}")
        print(f"Viewer counts: {sorted(self.data['numViewers'].unique())}")
        
        return self.data
    
    def generate_cpu_utilization_chart(self):
        """Generate CPU Utilization vs. Number of Viewers chart (0% packet loss)"""
        print("Generating CPU utilization chart...")
        
        # Filter data for 0% packet loss
        cpu_data = self.data[self.data['packetLoss'] == 0.0].copy()
        
        if cpu_data.empty:
            print("Warning: No data with 0% packet loss found for CPU chart")
            return
        
        # Group by architecture and number of viewers, calculate mean CPU
        cpu_grouped = cpu_data.groupby(['architecture', 'numViewers'])['avgCpu'].mean().reset_index()
        
        plt.figure(figsize=(10, 6))
        
        # Plot lines for each architecture
        for arch in cpu_grouped['architecture'].unique():
            arch_data = cpu_grouped[cpu_grouped['architecture'] == arch]
            plt.plot(arch_data['numViewers'], arch_data['avgCpu'], 
                    marker='o', linewidth=2, label=f'{arch} Architecture', markersize=8)
        
        plt.xlabel('Number of Viewers', fontsize=12)
        plt.ylabel('CPU Utilization (%)', fontsize=12)
        plt.title('Presenter CPU Utilization vs. Number of Viewers\n(0% Packet Loss)', fontsize=14, fontweight='bold')
        plt.legend(fontsize=11)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        
        output_path = self.output_dir / 'cpu_utilization.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"CPU utilization chart saved to {output_path}")
    
    def generate_latency_vs_loss_chart(self):
        """Generate Glass-to-Glass Latency vs. Packet Loss Rate chart (N=5 viewers)"""
        print("Generating latency vs packet loss chart...")
        
        # Filter data for N=5 viewers
        latency_data = self.data[self.data['numViewers'] == 5].copy()
        
        if latency_data.empty:
            print("Warning: No data with 5 viewers found for latency chart")
            return
        
        # Group by architecture and packet loss, calculate mean latency
        latency_grouped = latency_data.groupby(['architecture', 'packetLoss'])['avgLatency'].mean().reset_index()
        
        plt.figure(figsize=(10, 6))
        
        # Convert packet loss to percentage for display
        latency_grouped['packetLossPercent'] = latency_grouped['packetLoss'] * 100
        
        # Plot lines for each architecture
        for arch in latency_grouped['architecture'].unique():
            arch_data = latency_grouped[latency_grouped['architecture'] == arch]
            plt.plot(arch_data['packetLossPercent'], arch_data['avgLatency'], 
                    marker='s', linewidth=2, label=f'{arch} Architecture', markersize=8)
        
        plt.xlabel('Packet Loss Rate (%)', fontsize=12)
        plt.ylabel('Glass-to-Glass Latency (ms)', fontsize=12)
        plt.title('Glass-to-Glass Latency vs. Packet Loss Rate\n(N=5 viewers)', fontsize=14, fontweight='bold')
        plt.legend(fontsize=11)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        
        output_path = self.output_dir / 'latency_vs_loss.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"Latency vs packet loss chart saved to {output_path}")
    
    def generate_tls_vs_bandwidth_chart(self):
        """Generate Text Legibility Score vs. Presenter Bandwidth chart"""
        print("Generating TLS vs bandwidth chart...")
        
        # Filter data for N=5 viewers and 0% packet loss
        tls_data = self.data[(self.data['numViewers'] == 5) & (self.data['packetLoss'] == 0.0)].copy()
        
        if tls_data.empty:
            print("Warning: No data with 5 viewers and 0% packet loss found for TLS chart")
            return
        
        # Group by architecture and bandwidth, calculate mean TLS
        tls_grouped = tls_data.groupby(['architecture', 'bandwidth'])['avgTls'].mean().reset_index()
        
        # Convert bandwidth to numerical values for proper ordering
        bandwidth_order = {'1mbit': 1, '2mbit': 2, '5mbit': 5}
        tls_grouped['bandwidthNum'] = tls_grouped['bandwidth'].map(bandwidth_order)
        tls_grouped = tls_grouped.sort_values('bandwidthNum')
        
        plt.figure(figsize=(10, 6))
        
        # Plot bars for each architecture
        architectures = tls_grouped['architecture'].unique()
        x = np.arange(len(tls_grouped['bandwidth'].unique()))
        width = 0.35
        
        for i, arch in enumerate(architectures):
            arch_data = tls_grouped[tls_grouped['architecture'] == arch]
            offset = width * (i - len(architectures)/2 + 0.5)
            plt.bar(x + offset, arch_data['avgTls'], width, 
                   label=f'{arch} Architecture', alpha=0.8)
        
        plt.xlabel('Presenter Bandwidth', fontsize=12)
        plt.ylabel('Text Legibility Score (Levenshtein Distance)', fontsize=12)
        plt.title('Text Legibility Score (TLS) vs. Presenter Bandwidth\n(N=5 viewers, 0% packet loss)', 
                 fontsize=14, fontweight='bold')
        plt.xticks(x, ['1 Mbps', '2 Mbps', '5 Mbps'])
        plt.legend(fontsize=11)
        plt.grid(True, alpha=0.3, axis='y')
        plt.tight_layout()
        
        output_path = self.output_dir / 'tls_vs_bandwidth.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"TLS vs bandwidth chart saved to {output_path}")
    
    def generate_summary_statistics(self):
        """Generate and save summary statistics"""
        print("Generating summary statistics...")
        
        summary = {
            'total_tests': len(self.data),
            'architectures': list(self.data['architecture'].unique()),
            'viewer_counts': sorted(list(self.data['numViewers'].unique())),
            'packet_loss_rates': sorted(list(self.data['packetLoss'].unique())),
            'bandwidth_limits': list(self.data['bandwidth'].unique()),
            'overall_stats': {
                'cpu_utilization': {
                    'mean': float(self.data['avgCpu'].mean()),
                    'std': float(self.data['avgCpu'].std()),
                    'min': float(self.data['avgCpu'].min()),
                    'max': float(self.data['avgCpu'].max())
                },
                'latency': {
                    'mean': float(self.data['avgLatency'].mean()),
                    'std': float(self.data['avgLatency'].std()),
                    'min': float(self.data['avgLatency'].min()),
                    'max': float(self.data['avgLatency'].max())
                },
                'tls': {
                    'mean': float(self.data['avgTls'].mean()),
                    'std': float(self.data['avgTls'].std()),
                    'min': float(self.data['avgTls'].min()),
                    'max': float(self.data['avgTls'].max())
                }
            }
        }
        
        # Architecture comparison
        arch_comparison = {}
        for arch in self.data['architecture'].unique():
            arch_data = self.data[self.data['architecture'] == arch]
            arch_comparison[arch] = {
                'tests': len(arch_data),
                'avg_cpu': float(arch_data['avgCpu'].mean()),
                'avg_latency': float(arch_data['avgLatency'].mean()),
                'avg_tls': float(arch_data['avgTls'].mean())
            }
        
        summary['architecture_comparison'] = arch_comparison
        
        summary_file = self.output_dir / 'summary_statistics.json'
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"Summary statistics saved to {summary_file}")
        return summary
    
    def run_analysis(self):
        """Run complete analysis and generate all visualizations"""
        print("Starting data analysis...")
        
        try:
            self.load_data()
            
            if self.data is not None and not self.data.empty:
                self.generate_cpu_utilization_chart()
                self.generate_latency_vs_loss_chart()
                self.generate_tls_vs_bandwidth_chart()
                summary = self.generate_summary_statistics()
                
                print("\n=== Analysis Complete ===")
                print(f"Generated visualizations in: {self.output_dir}")
                print(f"Total tests analyzed: {summary['total_tests']}")
                print(f"Architectures compared: {', '.join(summary['architectures'])}")
                
                return True
            else:
                print("Error: No valid data loaded")
                return False
                
        except Exception as e:
            print(f"Error during analysis: {e}")
            import traceback
            traceback.print_exc()
            return False

def main():
    results_dir = os.environ.get('RESULTS_DIR', './results')
    
    print("WebRTC Screen Sharing Performance Analysis")
    print("==========================================")
    print(f"Results directory: {results_dir}")
    
    analyzer = DataAnalyzer(results_dir)
    success = analyzer.run_analysis()
    
    if success:
        print("\nVisualization files generated:")
        print("- cpu_utilization.png")
        print("- latency_vs_loss.png") 
        print("- tls_vs_bandwidth.png")
        print("- summary_statistics.json")
    else:
        print("Analysis failed!")
        exit(1)

if __name__ == "__main__":
    main()