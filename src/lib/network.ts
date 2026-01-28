import { fetch } from '@tauri-apps/plugin-http';

export const PROMPT_MIRROR_BASES = [
  'https://gitee.com/winriseF/models/raw/master/build/dist/',
  'https://raw.githubusercontent.com/WinriseF/CtxRun/main/build/dist/',
  'https://cdn.jsdelivr.net/gh/WinriseF/CtxRun@main/build/dist/'
];

export const MODEL_MIRROR_BASES = [
  'https://gitee.com/winriseF/models/raw/master/',
  'https://cdn.jsdelivr.net/gh/WinriseF/CtxRun@main/',
  'https://raw.githubusercontent.com/WinriseF/CtxRun/main/'
];

export interface MirrorOptions<T> {
  path: string;
  cacheBust?: boolean;
  responseType?: 'json' | 'text';
  validate?: (data: T) => boolean;
  timeout?: number;
}

export interface FetchResult<T> {
  data: T;
  sourceUrl: string;
}

export async function fetchFromMirrors<T>(
  bases: string[],
  options: MirrorOptions<T>
): Promise<FetchResult<T>> {
  const {
    path,
    cacheBust = false,
    responseType = 'json',
    validate,
    timeout = 8000
  } = options;

  const promises = bases.map(async (base) => {
    const baseUrl = base.endsWith('/') ? base : `${base}/`;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const urlObj = new URL(cleanPath, baseUrl);

    if (cacheBust) {
      urlObj.searchParams.set('t', Date.now().toString());
    }

    const url = urlObj.toString();

    const response = await fetch(url, {
      method: 'GET',
      connectTimeout: timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${base}`);
    }

    const data = responseType === 'json' ? await response.json() : await response.text();

    if (validate && !validate(data as T)) {
      throw new Error(`Validation failed for content from ${base}`);
    }

    return { data: data as T, sourceUrl: baseUrl };
  });

  try {
    return await Promise.any(promises);
  } catch (error) {
    console.error('[Network] All mirror sources failed:', error);
    throw new Error('Failed to fetch resource from any available mirror.');
  }
}
