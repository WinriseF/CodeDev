import { readDir } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { FileNode, IgnoreConfig } from '@/types/context';

/**
 * 核心递归扫描函数
 */
export async function scanProject(
  path: string, 
  config: IgnoreConfig
): Promise<FileNode[]> {
  try {
    const entries = await readDir(path);
    
    // 并行处理
    const nodes = await Promise.all(entries.map(async (entry) => {
      const name = entry.name;
      // 手动拼接完整路径
      const fullPath = await join(path, name);
      
      // 1. 黑名单过滤 (保持原有逻辑)
      // 这里简单按名称过滤，未区分文件/文件夹
      if (config.dirs.includes(name)) return null;
      if (config.files.includes(name)) return null;
      
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext && config.extensions.includes(ext)) return null;

      // 2. 探测类型 & 递归
      const isDir = entry.isDirectory;
      
      let children: FileNode[] | undefined = undefined;
      let size = 0;

      if (isDir) {
        try {
          // 如果是文件夹，递归扫描
          children = await scanProject(fullPath, config);
        } catch (e) {
          // 如果递归失败（如权限问题），视为空文件夹或被忽略
          console.warn(`Failed to scan dir: ${fullPath}`, e);
        }
      } else {
        // 如果是文件，调用 Rust 获取真实大小
        try {
          size = await invoke('get_file_size', { path: fullPath });
        } catch (err) {
          console.warn('Failed to get size:', err);
        }
      }

      // 3. 构造节点
      const node: FileNode = {
        id: fullPath,
        name: name,
        path: fullPath,
        kind: isDir ? 'dir' : 'file',
        size: size,
        children: isDir ? children : undefined,
        isSelected: true, 
        isExpanded: false
      };
      
      return node;
    }));

    // 过滤 null 并排序
    const validNodes = nodes.filter((n): n is FileNode => n !== null);
    return validNodes.sort((a, b) => {
      if (a.kind === b.kind) return a.name.localeCompare(b.name);
      return a.kind === 'dir' ? -1 : 1;
    });

  } catch (err) {
    throw err;
  }
}