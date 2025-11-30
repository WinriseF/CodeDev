export type PatchMode = 'patch' | 'diff';

export interface PatchOperation {
  originalBlock: string;
  modifiedBlock: string;
}

export interface FilePatch {
  filePath: string;
  operations: PatchOperation[];
}

export interface PatchFileItem {
  id: string;
  path: string;
  original: string;
  modified: string;
  status: 'pending' | 'success' | 'error';
  // 如果 status 是 error，这里存储具体的失败原因
  errorMsg?: string;
  // 标记是否为手动模式
  isManual?: boolean;
}