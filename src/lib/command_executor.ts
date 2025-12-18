import { Command } from '@tauri-apps/plugin-shell';
import { type as getOsType } from '@tauri-apps/plugin-os';
import { message } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { join, tempDir } from '@tauri-apps/api/path';
import { ShellType } from '@/types/prompt';
import { useConfirmStore } from '@/store/useConfirmStore';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';

// 定义高风险命令关键词
const DANGEROUS_KEYWORDS = [
  'rm ', 'del ', 'remove-item', 'mv ', 'move ', 'format', 'mkfs', '>', 'chmod ', 'chown ', 'icacls '
];

// 风险检测函数
const checkCommandRisk = (commandStr: string): boolean => {
  const lowerCaseCmd = commandStr.toLowerCase().trim();
  return DANGEROUS_KEYWORDS.some(keyword => {
    if (keyword === '>') return lowerCaseCmd.includes('>');
    return new RegExp(`\\b${keyword}`).test(lowerCaseCmd);
  });
};

const showNotification = async (msg: string, type: 'info' | 'error' = 'info') => {
  await message(msg, { title: 'CodeForge AI', kind: type });
};

/**
 * 核心执行函数
 * @param commandStr 要执行的命令字符串
 * @param _shell Shell类型 (暂未使用，通过后缀名区分)
 * @param cwd 指定工作目录 (可选，默认为临时目录)
 */
export async function executeCommand(commandStr: string, _shell: ShellType = 'auto', cwd?: string | null) {
  const language = useAppStore.getState().language;
  // 1. 安全审查 (使用自定义 UI 组件)
  if (checkCommandRisk(commandStr)) {
    const confirmed = await useConfirmStore.getState().ask({
        title: getText('executor', 'riskTitle', language),
        message: getText('executor', 'riskMsg', language, { command: commandStr }),
        type: 'danger',
        confirmText: getText('executor', 'btnExecute', language),
        cancelText: getText('prompts', 'cancel', language)
    });
    
    if (!confirmed) return;
  }

  const osType = await getOsType();
  
  try {
    const baseDir = await tempDir();
    const cleanCwd = (cwd || baseDir).replace(/[\\/]$/, ''); 
    const timestamp = Date.now();

    if (osType === 'windows') {
      // --- Windows 逻辑 (.bat) ---
      const fileName = `codeforge_exec_${timestamp}.bat`;
      const scriptPath = await join(baseDir, fileName);
      
      /* 
       Windows 批处理逻辑：
       1. 不含中文注释，防止 GBK/UTF-8 编码冲突。
       2. 使用 @echo on 自动回显命令，完美解决多行、特殊符号(>|&)转义问题。
       3. 只有命令部分开启回显，其他部分关闭，模拟原生体验。
       4. 最后使用 start /b ... del 自我销毁。
      */
      const fileContent = `
@echo off
cd /d "${cleanCwd}"
cls
ver
echo (c) Microsoft Corporation. All rights reserved.
echo.

:: Enable echo to simulate terminal behavior
@echo on
${commandStr}
@echo off

echo.
pause
start /b "" cmd /c del "%~f0"&exit /b
      `.trim();

      await writeTextFile(scriptPath, fileContent);
      
      // 启动新 CMD 窗口运行脚本
      const cmd = Command.create('cmd', ['/c', 'start', '', scriptPath]);
      await cmd.spawn();

    } else if (osType === 'macos') {
      // --- macOS 逻辑 (.sh) ---
      const fileName = `codeforge_exec_${timestamp}.sh`;
      const scriptPath = await join(baseDir, fileName);

      // 手动构造回显，Mac 下 echo 显示比较稳定
      const fileContent = `
#!/bin/bash
clear
cd "${cleanCwd}"
echo "$(pwd) $ ${commandStr.split('\n').join('\n> ')}"
${commandStr}
echo ""
echo "[Process completed]"
read -n 1 -s -r -p "Press any key to close..."
rm "$0"
      `.trim();

      await writeTextFile(scriptPath, fileContent);
      
      // 使用 AppleScript 唤起 Terminal.app
      const appleScript = `
        tell application "Terminal"
          activate
          do script "sh '${scriptPath}'"
        end tell
      `;
      const cmd = Command.create('osascript', ['-e', appleScript]);
      await cmd.spawn();

    } else if (osType === 'linux') {
      // --- Linux 逻辑 (.sh) ---
      const fileName = `codeforge_exec_${timestamp}.sh`;
      const scriptPath = await join(baseDir, fileName);

      const fileContent = `
#!/bin/bash
cd "${cleanCwd}"
echo "$(pwd) $ ${commandStr.split('\n').join('\n> ')}"
${commandStr}
echo ""
echo "Press Enter to close..."
read
rm "$0"
      `.trim();

      await writeTextFile(scriptPath, fileContent);
      
      // 调用通用终端模拟器
      const cmd = Command.create('x-terminal-emulator', ['-e', `bash "${scriptPath}"`]);
      await cmd.spawn();

    } else {
      await showNotification(getText('executor', 'unsupported', language), "error");
    }

  } catch (e: any) {
    console.error("Execution failed:", e);
    await showNotification(`Execution failed: ${e.message || e}`, "error");
  }
}