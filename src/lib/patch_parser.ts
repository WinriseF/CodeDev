import yaml from 'js-yaml';
import { PatchOperation, FilePatch } from '@/components/features/patch/patch_types';

// 定义应用结果接口
export interface ApplyResult {
  modified: string;
  success: boolean;
  errors: string[];
}

interface YamlPatchItem {
  file?: string;
  replace?: {
    original: string;
    modified: string;
    context_before?: string;
    context_after?: string;
  };
  insert_after?: {
    anchor: string;
    content: string;
  };
}

/**
 * 解析 YAML
 */
export function parseMultiFilePatch(yamlContent: string): FilePatch[] {
  const filePatches: FilePatch[] = [];
  let currentFile: FilePatch | null = null;

  // 预处理：有些 AI 会在 YAML 外面包一层 ```yaml，先去除
  const cleanYaml = yamlContent.replace(/```yaml/g, '').replace(/```/g, '').trim();

  try {
    const doc = yaml.load(cleanYaml);
    if (!Array.isArray(doc)) return [];

    for (const item of doc as YamlPatchItem[]) {
      if (item.file) {
        let existing = filePatches.find(f => f.filePath === item.file);
        if (!existing) {
          existing = { filePath: item.file, operations: [] };
          filePatches.push(existing);
        }
        currentFile = existing;
      }

      // 如果没有 file 字段但有操作，归属到上一个文件或 unknown
      if (!currentFile && (item.replace || item.insert_after)) {
         currentFile = { filePath: 'unknown_file', operations: [] };
         filePatches.push(currentFile);
      }

      if (!currentFile) continue;

      if (item.replace) {
        const { original, modified, context_before = '', context_after = '' } = item.replace;
        // 拼接上下文，增加定位准确度
        const originalBlock = [context_before, original, context_after].filter(Boolean).join('\n');
        const modifiedBlock = [context_before, modified, context_after].filter(Boolean).join('\n');
        
        currentFile.operations.push({
          type: 'replace',
          originalBlock,
          modifiedBlock,
        });
      } else if (item.insert_after) {
        const { anchor, content } = item.insert_after;
        currentFile.operations.push({
          type: 'insert_after',
          originalBlock: anchor,
          modifiedBlock: `${anchor}\n${content}`,
        });
      }
    }
  } catch (e) {
    console.error("YAML Parse Error", e);
  }

  return filePatches;
}

/**
 * 辅助：标准化代码字符串（移除所有空白符，用于模糊匹配定位）
 */
function normalizeToStream(str: string): string {
    return str.replace(/\s+/g, '');
}

/**
 * 核心：应用补丁（带三级容错）
 */
export function applyPatches(originalCode: string, operations: PatchOperation[]): ApplyResult {
  let resultCode = originalCode.replace(/\r\n/g, '\n'); // 统一换行符
  const errors: string[] = [];
  let successCount = 0;

  for (const op of operations) {
    const searchBlock = op.originalBlock.replace(/\r\n/g, '\n').trim();
    const replaceBlock = op.modifiedBlock.replace(/\r\n/g, '\n').trim();

    if (!searchBlock) continue;

    // --- 策略 1: 严格全字匹配 ---
    if (resultCode.includes(searchBlock)) {
      resultCode = resultCode.replace(searchBlock, replaceBlock);
      successCount++;
      continue;
    }

    // --- 策略 2: 宽松匹配 (忽略首尾空格) ---
    const searchLines = searchBlock.split('\n').map(l => l.trim());
    const sourceLines = resultCode.split('\n');
    
    let matchFound = false;
    
    // 简单的滑动窗口匹配
    for (let i = 0; i <= sourceLines.length - searchLines.length; i++) {
        let isMatch = true;
        for (let j = 0; j < searchLines.length; j++) {
            if (sourceLines[i + j].trim() !== searchLines[j]) {
                isMatch = false;
                break;
            }
        }

        if (isMatch) {
            // 找到了！替换 sourceLines 从 i 到 i + searchLines.length 的内容
            const before = sourceLines.slice(0, i);
            const after = sourceLines.slice(i + searchLines.length);
            
            // 插入新的块
            resultCode = [...before, replaceBlock, ...after].join('\n');
            matchFound = true;
            successCount++;
            break;
        }
    }

    if (matchFound) continue;

    // --- 策略 3: 极简流式匹配 (最后手段) ---
    // 用于区分 "完全找不到" 还是 "格式太乱导致无法自动应用"
    if (searchBlock.length > 10) {
        const normSearch = normalizeToStream(searchBlock);
        const normSource = normalizeToStream(resultCode);
        
        // 真正使用了 normSource 和 normSearch
        if (normSource.includes(normSearch)) {
            // 代码内容存在，但空白符/换行符差异太大，导致策略2失败
            // 这种情况下很难自动安全替换，因为不知道 replaceBlock 应该插入的具体索引
            errors.push(`Found content but format differs significantly: "${searchBlock.substring(0, 30)}..."`);
        } else {
            // 连压缩后的内容都找不到，说明代码真的不存在
            errors.push(`Block not found: "${searchBlock.substring(0, 30)}..."`);
        }
    } else {
        errors.push(`Block not found (too short): "${searchBlock.substring(0, 30)}..."`);
    }
  }

  return {
      modified: resultCode,
      success: errors.length === 0,
      errors
  };
}