import { readTextFile } from '@tauri-apps/api/fs';
import { FileNode } from '@/types/context';
import { countTokens } from './tokenizer';
import { generateAsciiTree } from './tree_generator';
import { stripSourceComments } from './comment_stripper'; // ✨ 引入

// 二进制/非文本后缀黑名单
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg',
  'mp3', 'mp4', 'wav', 'ogg', 'mov', 'avi',
  'zip', 'tar', 'gz', '7z', 'rar', 'jar',
  'exe', 'dll', 'so', 'dylib', 'bin', 'obj', 'o', 'a', 'lib',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'db', 'sqlite', 'sqlite3', 'class', 'pyc', 'DS_Store'
]);

export interface ContextStats {
  fileCount: number;
  totalSize: number;
  estimatedTokens: number;
}

export function getSelectedFiles(nodes: FileNode[]): FileNode[] {
  let files: FileNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'file' && node.isSelected) {
      files.push(node);
    }
    if (node.children) {
      files = files.concat(getSelectedFiles(node.children));
    }
  }
  return files;
}

export function calculateStats(nodes: FileNode[]): ContextStats {
  const files = getSelectedFiles(nodes);
  let totalSize = 0;
  for (const f of files) {
    totalSize += f.size || 0;
  }
  return {
    fileCount: files.length,
    totalSize: totalSize,
    estimatedTokens: Math.ceil(totalSize / 4)
  };
}

// 定义生成选项接口
interface GenerateOptions {
  removeComments: boolean;
}

/**
 * 升级后的上下文生成器
 */
export async function generateContext(
  nodes: FileNode[], 
  options: GenerateOptions = { removeComments: false } // ✨ 接收选项
): Promise<{ text: string, tokenCount: number }> {
  
  const files = getSelectedFiles(nodes);
  const treeString = generateAsciiTree(nodes);
  
  const parts: string[] = [];

  // --- 1. System Preamble ---
  parts.push(`<project_context>`);
  parts.push(`This is a source code context provided by CodeForge AI.`);
  parts.push(`Total Files: ${files.length}`);
  if (options.removeComments) {
      parts.push(`Note: Comments have been stripped to save tokens.`);
  }
  parts.push(``);

  // --- 2. Project Structure ---
  parts.push(`<project_structure>`);
  parts.push(treeString);
  parts.push(`</project_structure>`);
  parts.push(``);

  // --- 3. File Contents ---
  parts.push(`<source_files>`);
  
  const filePromises = files.map(async (file) => {
    try {
      // 防御 1: 检查后缀 (Binary Guard)
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && BINARY_EXTENSIONS.has(ext)) {
          return `
<file path="${file.path}">
[Binary file omitted: ${file.name}]
</file>`;
      }

      // 防御 2: 检查大小 (> 1MB)
      if (file.size && file.size > 1024 * 1024) { 
           return `
<file path="${file.path}">
[File too large to include: ${(file.size / 1024 / 1024).toFixed(2)} MB]
</file>`;
      }

      let content = await readTextFile(file.path);

      // 特性: 移除注释
      if (options.removeComments) {
          content = stripSourceComments(content, file.name);
      }

      return `
<file path="${file.path}">
${content}
</file>`;
    } catch (err) {
      console.warn(`Failed to read file: ${file.path}`, err);
      return `
<file path="${file.path}">
[Error: Unable to read file content]
</file>`;
    }
  });

  const fileContents = await Promise.all(filePromises);
  parts.push(...fileContents);
  
  parts.push(`</source_files>`);
  parts.push(`</project_context>`);

  const fullText = parts.join('\n');
  const finalTokens = countTokens(fullText);

  return {
    text: fullText,
    tokenCount: finalTokens
  };
}