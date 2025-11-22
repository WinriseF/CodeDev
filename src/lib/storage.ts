import { readTextFile, writeTextFile, createDir, exists, BaseDirectory } from '@tauri-apps/api/fs';

// 判断当前环境
const isDev = import.meta.env.DEV;

// 定义文件名
const CONFIG_FILE = 'config.json';
// 生产环境下的文件夹名 (exe同级)
const PROD_DIR = 'data';

export const fileStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      // --- 开发环境：从系统 AppData 读取 ---
      if (isDev) {
        // 路径类似: C:\Users\你\AppData\Local\com.codeforge.ai\config.json
        const existsFile = await exists(CONFIG_FILE, { dir: BaseDirectory.AppLocalData });
        if (!existsFile) return null;
        return await readTextFile(CONFIG_FILE, { dir: BaseDirectory.AppLocalData });
      } 
      
      // --- 生产环境：从 ./data 读取 (绿色便携) ---
      else {
        const path = `${PROD_DIR}/${CONFIG_FILE}`;
        if (!(await exists(path))) return null;
        return await readTextFile(path);
      }
    } catch (err) {
      console.warn('[Config] 读取失败:', err);
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      // --- 开发环境：写入系统 AppData ---
      if (isDev) {
        // BaseDirectory.AppLocalData 会自动指向 AppData/Local/com.codeforge.ai/
        // 1. 确保目录存在
        if (!(await exists('', { dir: BaseDirectory.AppLocalData }))) {
           await createDir('', { dir: BaseDirectory.AppLocalData, recursive: true });
        }
        // 2. 写入
        await writeTextFile(CONFIG_FILE, value, { dir: BaseDirectory.AppLocalData });
        console.log('[Dev] 配置已保存到 AppData');
      } 
      
      // --- 生产环境：写入 ./data (绿色便携) ---
      else {
        // 1. 确保 data 目录存在
        if (!(await exists(PROD_DIR))) {
          await createDir(PROD_DIR, { recursive: true });
        }
        // 2. 写入
        const path = `${PROD_DIR}/${CONFIG_FILE}`;
        await writeTextFile(path, value);
      }
    } catch (err) {
      console.error('[Config] 写入失败:', err);
      alert('配置保存失败，请按 F12 查看控制台错误');
    }
  },

  removeItem: async () => {},
};