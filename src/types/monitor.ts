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
  is_system: boolean;
}

export interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  process_name: string;
  local_addr?: string;
  is_system: boolean;
}

export interface NetDiagResult {
  id: string;
  name: string;
  url: string;
  status: 'Success' | 'Fail' | 'Slow';
  latency: number;
  status_code: number;
}

export interface ToolInfo {
  name: string;
  version: string;
  path?: string;
  description?: string;
}

export interface EnvReport {
  system: Record<string, string> | null; // OS, CPU, Memory 等键值对
  binaries: ToolInfo[];
  browsers: ToolInfo[];
  ides: ToolInfo[];
  languages: ToolInfo[];
  virtualization: ToolInfo[];
  utilities: ToolInfo[];
  managers: ToolInfo[];
  databases: ToolInfo[];
  npm_packages: ToolInfo[];
  sdks: Record<string, string[]>;
}

export type ProjectType = 'Tauri' | 'NodeFrontend' | 'NodeBackend' | 'Rust' | 'Python' | 'Mixed';

export interface AiContextReport {
    project_type: ProjectType;
    summary: string;
    system_info: string;
    toolchain: ToolInfo[];
    dependencies: Record<string, string>;
    markdown: string;
}

export interface LockedFileProcess {
  pid: number;
  name: string;
  icon?: string;
  user: string;
  is_system: boolean;
}