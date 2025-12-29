export interface SystemMetrics {
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory: number;
  user: string;
  is_system: boolean; // 新增字段
}

export interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  process_name: string;
  local_addr?: string;
  is_system: boolean; // 新增字段
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