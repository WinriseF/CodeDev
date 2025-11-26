import strip from 'strip-comments';

/**
 * 根据文件类型移除代码注释
 * 使用 strip-comments 库以确保识别准确度
 */
export function stripSourceComments(content: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // 映射语言类型
  let langType = '';

  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'json': 
    case 'jsonc':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'cs': // c#
    case 'go':
    case 'rs': // Rust
    case 'swift':
    case 'kt': // Kotlin
    case 'scala':
    case 'dart':
      langType = 'js'; // C-style comments (// and /* */)
      break;
    
    case 'py':
    case 'rb': // Ruby
    case 'pl': // Perl
    case 'sh': // Shell
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'dockerfile':
    case 'conf':
      langType = 'python'; // Hash comments (#)
      break;

    case 'html':
    case 'xml':
    case 'vue':
    case 'svelte':
    case 'svg':
      langType = 'html'; // <!-- -->
      break;

    case 'css':
    case 'scss':
    case 'less':
      langType = 'css'; // /* */
      break;

    case 'php':
      langType = 'php';
      break;
      
    case 'sql':
      langType = 'sql';
      break;

    default:
      // 不支持的类型，原样返回
      return content;
  }

  try {
    // preserveNewlines: false 会删除注释占据的空行，极大节省 token
    return strip(content, { language: langType, preserveNewlines: false });
  } catch (e) {
    console.warn(`[Stripper] Failed to process ${fileName}`, e);
    return content;
  }
}