// src/lib/fs_helper.ts
import { readDir, FileEntry } from '@tauri-apps/api/fs';
import { join, sep } from '@tauri-apps/path'; // 注意：Tauri v1 路径处理
import { FileNode, IgnoreConfig } from '@/types/context';

// 辅助：检查是否应该忽略
function shouldIgnore(name: string, isDir: boolean, config: IgnoreConfig): boolean {
  // 1. 检查文件夹名
  if (isDir && config.dirs.includes(name)) return true;
  
  // 2. 检查文件名
  if (!isDir && config.files.includes(name)) return true;

  // 3. 检查后缀名
  if (!isDir) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext && config.extensions.includes(ext)) return true;
  }

  return false;
}

/**
 * 将 Tauri 的 FileEntry 转换为我们的 FileNode
 * 并根据配置决定是否深入递归
 */
async function processEntry(
  entry: FileEntry, 
  parentPath: string, 
  config: IgnoreConfig
): Promise<FileNode | null> {
  const name = entry.name || '';
  
  // --- 关键：剪枝逻辑 ---
  // 如果在黑名单里，直接返回 null，不包含在树中
  const isDir = !!entry.children; // Tauri v1 readDir recursive:false 时无法准确判断 isDir，通常依靠 children 或 metadata
  // 但为了手动递归控制，我们通过 entry 本身的属性判断
  // 注意：Tauri 的 FileEntry 可能没有明确的 isDir 属性，通常根据 context 判断
  // 这里我们假设如果我们要进入递归，必须确定它是目录
  
  // 由于 Tauri API 的限制，我们需要一种方式确认识别目录。
  // 简单起见，我们利用 recursive: false 读取时，需要额外判断。
  // 但在 fs_helper 中，我们通常传入的是路径。
  
  // 简化策略：
  // 下面的 scanDirectory 负责具体的 Dir 逻辑，这里负责结构转换
  return null; // 占位，实际逻辑在下方递归函数中
}

/**
 * 核心递归扫描函数
 */
export async function scanProject(
  path: string, 
  config: IgnoreConfig
): Promise<FileNode[]> {
  try {
    // 读取当前目录内容 (不递归，手动控制)
    const entries = await readDir(path, { recursive: false });
    
    const nodes: FileNode[] = [];

    // 并行处理当前层级，提升速度
    const promises = entries.map(async (entry) => {
      const name = entry.name || '';
      const fullPath = entry.path;
      
      // 注意：Tauri FileEntry 在 recursive: false 时，children 可能是 undefined
      // 我们需要判断它是文件还是文件夹。Tauri 1.x 的 entry.children 存在即为文件夹是不准确的。
      // 可靠的方法是看 `entry.children` 是否存在 (如果是 recursive: true)，
      // 但如果是 recursive: false，所有条目都没有 children。
      // 实际上 Tauri 的 FileEntry 只有 `name`, `path`, `children`。
      // 我们通常假设没有后缀名且没有 children 的可能是文件夹，但这不稳健。
      // **修正方案**：使用 metadata 或根据路径推断，或者尝试作为文件夹读取。
      // 这里为了演示清晰，我们根据 name 和 recursive 调用结果来判断。
      
      // 判断是否是文件夹的 trick：尝试读取它的子目录？
      // 或者使用 Rust 后端提供的 metadata？(Tauri fs 插件目前前端只能做这么多)
      // *通常在 Tauri v1 中，readDir 返回的 entry 如果是文件夹，children 属性会是 Array (哪怕空的)* 
      // *如果是文件，children 是 undefined。*
      
      const isDir = entry.children !== undefined; // 仅当 recursive: true 时有效？
      // 不，Tauri v1 的 fs.readDir(recursive: false) 对文件夹也会返回 children: [] 吗？
      // 经查阅文档：Tauri fs readDir 仅在 recursive: true 时填充 children。
      // 在 recursive: false 时，我们需要另一种方式判断 isDirectory。
      // 实际上，Tauri 的 entry 有个隐藏的行为：如果它是文件夹，你可以对它调用 readDir。
      
      // === 实用主义方案 ===
      // 我们先假设所有条目通过名字判断。
      // 但最稳妥的是：我们在下面尝试递归 readDir，如果成功它就是文件夹。
      
      // 让我们用一个更简单的假设：Tauri v1 在 readDir 时，
      // 返回的 entry 有个 `file_type` 吗？没有。
      // 现在的最佳实践是：根据 `entry.children` 无法判断。
      // 我们必须依赖 `metadata` (需要 fs-extra 类似的逻辑，但 Tauri fs 没有 sync isDirectory)。
      
      // **补救措施**：
      // 我们通过尝试 readDir 来判断是否是文件夹。这会有性能损耗但最准确。
      // 或者，我们接受 Tauri 的限制，使用 `entry.path` 结尾是否带斜杠？不行。
      
      // 查阅 Tauri 源码：`readDir` 的 entries 会包含文件类型信息，但在 JS层被屏蔽了。
      // 让我们先假定我们可以通过逻辑判断。
      
      // 临时方案：如果名字里没有点，或者在 config.dirs 里，我们当它是文件夹尝试读取。
      // 更好的方案：我们不管它是啥，通过 `metadata` 接口确认。
      // import { metadata } from '@tauri-apps/api/fs';
      // const meta = await metadata(fullPath);
      // const isDir = meta.isDir;
      
      // 但是并发调用 metadata 会很慢。
      // 为了本阶段核心逻辑，我们先写出框架，假设我们能知道 isDir。
      // 实际上，大部分 Tauri 开发者建议：看 `name` 是否是忽略列表里的文件夹。
    });

    // --- 重写逻辑：为了代码可运行，我们采用串行+TryCatch 探测 ---
    
    for (const entry of entries) {
      const name = entry.name || '';
      const fullPath = entry.path;
      
      // 1. 初步判断：是否在黑名单？
      // 由于还不知道是文件还是文件夹，我们先检查名字
      // 如果名字在 config.dirs 里，我们假设它是文件夹并忽略
      if (config.dirs.includes(name)) continue; 
      
      // 如果名字在 config.files 里，忽略
      if (config.files.includes(name)) continue;
      
      // 后缀检查
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext && config.extensions.includes(ext)) continue;

      // 2. 探测类型 & 递归
      // 我们尝试把它当文件夹读
      let children: FileNode[] | undefined = undefined;
      let isDir = false;
      
      try {
        // 尝试递归读取
        // 这是一个深度优先过程
        const subFiles = await scanProject(fullPath, config);
        children = subFiles;
        isDir = true;
      } catch (e) {
        // 报错说明不是文件夹，或者没权限，或者就是个文件
        isDir = false;
      }

      // 3. 构造节点
      // 如果它是文件，且不在忽略列表
      const node: FileNode = {
        id: fullPath,
        name: name,
        path: fullPath,
        kind: isDir ? 'dir' : 'file',
        children: isDir ? children : undefined,
        // 默认状态：如果是文件，默认选中；如果是文件夹，根据子节点选中状态决定（UI层处理）
        // 这里初始全为 false，让用户自己勾选，或者全为 true。
        // 需求说：打了勾就添加。通常 Context 工具默认是 "智能全选"。
        // 我们先设为 true (选中)，用户去剔除不需要的。
        isSelected: true, 
        isExpanded: false // 默认折叠
      };
      
      nodes.push(node);
    }

    // 排序：文件夹排前面
    return nodes.sort((a, b) => {
      if (a.kind === b.kind) return a.name.localeCompare(b.name);
      return a.kind === 'dir' ? -1 : 1;
    });

  } catch (err) {
    // 如果读取失败（比如没有权限，或者它其实是个文件），返回空数组或抛出
    // 在递归中，这意味着这是一个叶子节点（文件），由上层捕获
    throw err;
  }
}