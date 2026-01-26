export type PreviewType =
  | 'image'
  | 'video'
  | 'audio'
  | 'code'
  | 'markdown'
  | 'pdf'
  | 'archive'
  | 'binary'
  | 'office';

export interface FileMeta {
  path: string;
  name: string;
  size: number;
  previewType: PreviewType;
  mime: string;
}
