// src/lib/tokenizer.ts
import { getEncoding, Tiktoken } from 'js-tiktoken';

let encoder: Tiktoken | null = null;

function getEncoder() {
  if (!encoder) {
    encoder = getEncoding("cl100k_base");
  }
  return encoder;
}

export function countTokens(text: string): number {
  try {
    const enc = getEncoder();
    return enc.encode(text).length;
  } catch (e) {
    return 0;
  }
}

export function estimateTokens(byteSize: number): number {
  // 保守估算：1 Token ≈ 4 Bytes
  return Math.ceil(byteSize / 4);
}