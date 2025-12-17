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
  
  errorMsg?: string;
  isManual?: boolean;

  gitStatus?: 'Added' | 'Modified' | 'Deleted' | 'Renamed'; 
}