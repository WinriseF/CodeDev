import { Command } from '@tauri-apps/plugin-shell';
import { type as getOsType } from '@tauri-apps/plugin-os';
import { message } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { join, tempDir } from '@tauri-apps/api/path';
import { ShellType } from '@/types/prompt';
import { useConfirmStore } from '@/store/useConfirmStore';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';

// 危险命令关键词检测
const DANGEROUS_KEYWORDS = [
  'rm ', 'del ', 'remove-item', 'mv ', 'move ', 'format', 'mkfs', '>', 'chmod ', 'chown ', 'icacls '
];

// 检查命令风险
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

// 执行命令的主函数
export async function executeCommand(commandStr: string, shell: ShellType = 'auto', cwd?: string | null) {
  const language = useAppStore.getState().language;
  
  // 1. 风险检查
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
      
      // === Windows 逻辑 ===
      
      if (shell === 'powershell') {
        // --- PowerShell 分支 ---
        const fileName = `codeforge_exec_${timestamp}.ps1`;
        const scriptPath = await join(baseDir, fileName);

        // 构建 PowerShell 脚本内容
        // 注意：Remove-Item 用于执行后自删除脚本
        const psContent = `
Set-Location -Path "${cleanCwd}"
Clear-Host
Write-Host "Windows PowerShell (CodeForge AI)" -ForegroundColor Cyan
Write-Host "-----------------------------------"
Write-Host ""

# Execute User Command
${commandStr}

Write-Host ""
Write-Host "-----------------------------------"
Read-Host -Prompt "Press Enter to close"
Remove-Item -Path $MyInvocation.MyCommand.Path -Force
`.trim();

        await writeTextFile(scriptPath, psContent);

        // 使用 cmd /c start powershell ... 来弹出一个新的 PowerShell 窗口
        // -ExecutionPolicy Bypass 允许执行未签名的临时脚本
        const cmd = Command.create('cmd', [
            '/c', 
            'start', 
            'powershell', 
            '-NoProfile', 
            '-ExecutionPolicy', 'Bypass', 
            '-File', scriptPath
        ]);
        await cmd.spawn();

      } else {
        // --- CMD/Batch 分支 (默认) ---
        const fileName = `codeforge_exec_${timestamp}.bat`;
        const scriptPath = await join(baseDir, fileName);
        
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
        
        // 使用 start 命令弹出新窗口执行 bat
        const cmd = Command.create('cmd', ['/c', 'start', '', scriptPath]);
        await cmd.spawn();
      }

    } else if (osType === 'macos') {
      
      // === macOS 逻辑 ===
      // 这里也可以根据 shell 类型 (bash/zsh) 微调，但通常 .sh 兼容性最好
      
      const fileName = `codeforge_exec_${timestamp}.sh`;
      const scriptPath = await join(baseDir, fileName);
      const targetShell = shell === 'zsh' ? 'zsh' : 'bash';

      const fileContent = `
#!/bin/${targetShell}
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
      
      // macOS 使用 osascript 控制 Terminal.app
      // 这里显式指定用 sh 运行脚本，脚本内部 shebang 会决定解释器
      const appleScript = `
        tell application "Terminal"
          activate
          do script "sh '${scriptPath}'"
        end tell
      `;
      const cmd = Command.create('osascript', ['-e', appleScript]);
      await cmd.spawn();

    } else if (osType === 'linux') {
      
      // === Linux 逻辑 ===
      
      const fileName = `codeforge_exec_${timestamp}.sh`;
      const scriptPath = await join(baseDir, fileName);
      const targetShell = shell === 'zsh' ? 'zsh' : 'bash';

      const fileContent = `
#!/bin/${targetShell}
cd "${cleanCwd}"
echo "$(pwd) $ ${commandStr.split('\n').join('\n> ')}"
${commandStr}
echo ""
echo "Press Enter to close..."
read
rm "$0"
      `.trim();

      await writeTextFile(scriptPath, fileContent);
      
      // 尝试调用 x-terminal-emulator
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