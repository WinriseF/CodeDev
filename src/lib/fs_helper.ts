import { readDir } from '@tauri-apps/api/fs';
import { invoke } from '@tauri-apps/api/tauri'; // ✨ 引入 invoke
import { FileNode, IgnoreConfig } from '@/types/context';

/**
 * 核心递归扫描函数
 */
export async function scanProject(
  path: string, 
  config: IgnoreConfig
): Promise<FileNode[]> {
  try {
    // 读取当前目录内容
    const entries = await readDir(path, { recursive: false });
    
    // 并行处理
    const nodes = await Promise.all(entries.map(async (entry) => {
      const name = entry.name || '';
      const fullPath = entry.path;
      
      // 1. 黑名单过滤
      if (config.dirs.includes(name)) return null;
      if (config.files.includes(name)) return null;
      
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext && config.extensions.includes(ext)) return null;

      // 2. 探测类型 & 递归
      let children: FileNode[] | undefined = undefined;
      let isDir = false;
      let size = 0;

      try {
        // 尝试递归读取 (如果是文件夹，这步会成功)
        children = await scanProject(fullPath, config);
        isDir = true;
      } catch (e) {
        // 报错说明是文件
        isDir = false;
        
        // ✨ 核心修复：调用 Rust 后端获取真实大小
        // 这比前端读取文件快几千倍，且不会崩
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
        size: size, // 这里现在是真实的字节数了！
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