export interface SystemMetrics {
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
  // 如果后续 Rust 端实现了磁盘/网络监控，可在此扩展
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory: number;
}

export interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  process_name: string;
}

export interface EnvInfo {
  name: string;
  version: string;
}

export interface NetDiagResult {
  id: string;
  name: string;
  url: string;
  status: 'Success' | 'Fail' | 'Slow';
  latency: number;
  status_code: number;
}