import { readTextFile, writeTextFile, createDir, exists, BaseDirectory } from '@tauri-apps/api/fs';

// 判断当前环境
const isDev = import.meta.env.DEV;
// 生产环境下的文件夹名 (exe同级)
const PROD_DIR = 'data';

export const fileStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // 根据 name 生成文件名，例如 "prompts-data.json"
    const fileName = `${name}.json`;

    try {
      // --- 开发环境：从系统 AppData 读取 ---
      if (isDev) {
        const existsFile = await exists(fileName, { dir: BaseDirectory.AppLocalData });
        if (!existsFile) return null;
        return await readTextFile(fileName, { dir: BaseDirectory.AppLocalData });
      } 
      
      // --- 生产环境：从 ./data 读取 (绿色便携) ---
      else {
        const path = `${PROD_DIR}/${fileName}`;
        if (!(await exists(path))) return null;
        return await readTextFile(path);
      }
    } catch (err) {
      console.warn(`[Storage] 读取 ${fileName} 失败:`, err);
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    const fileName = `${name}.json`;

    try {
      // --- 开发环境：写入系统 AppData ---
      if (isDev) {
        // 1. 确保目录存在
        if (!(await exists('', { dir: BaseDirectory.AppLocalData }))) {
           await createDir('', { dir: BaseDirectory.AppLocalData, recursive: true });
        }
        // 2. 写入
        await writeTextFile(fileName, value, { dir: BaseDirectory.AppLocalData });
      } 
      
      // --- 生产环境：写入 ./data (绿色便携) ---
      else {
        // 1. 确保 data 目录存在
        if (!(await exists(PROD_DIR))) {
          await createDir(PROD_DIR, { recursive: true });
        }
        // 2. 写入
        const path = `${PROD_DIR}/${fileName}`;
        await writeTextFile(path, value);
      }
    } catch (err) {
      console.error(`[Storage] 写入 ${fileName} 失败:`, err);
    }
  },

  removeItem: async () => {},
};