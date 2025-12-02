import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 简单的 Markdown 格式去除工具
 * 用于 "Copy as Text" 功能
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return '';

  return markdown
    // 1. 移除代码块标记 (```language ...)
    // 保留代码内容，仅去除反引号和语言标识
    .replace(/```[\w-]*\n([\s\S]*?)\n```/g, '$1')
    .replace(/```([\s\S]*?)```/g, '$1')
    
    // 2. 移除行内代码 (`code`)
    .replace(/`([^`]+)`/g, '$1')
    
    // 3. 移除图片 (![alt](url)) -> 仅保留 alt 文本
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    
    // 4. 移除链接 ([text](url)) -> 仅保留 text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    
    // 5. 移除标题标记 (# Header)
    .replace(/^#+\s+/gm, '')
    
    // 6. 移除粗体和斜体 (**text**, *text*, __text__, _text_)
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    
    // 7. 移除引用符号 (> text)
    .replace(/^>\s+/gm, '')
    
    // 8. 移除水平分割线 (---, ***)
    .replace(/^(-{3,}|(\*{3,}))$/gm, '')
    
    // 9. 处理多余的换行（可选，视需求而定，这里保留换行但去除首尾空白）
    .trim();
}