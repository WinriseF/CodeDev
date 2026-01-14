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

    // ========================================================================
    // 新增：Python 处理逻辑
    // ========================================================================
    if (shell === 'python') {
        const pyFileName = `codeforge_script_${timestamp}.py`;
        const pyScriptPath = await join(baseDir, pyFileName);

        // 优化 Python 脚本内容，内置暂停逻辑，避免 Shell 层面复杂的命令拼接
        const pyContent = `
import os
import sys
import io

# 强制 UTF-8 输出 (解决 Windows 乱码问题)
if sys.platform.startswith('win'):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    except:
        pass

# 切换工作目录
try:
    os.chdir(r"${cleanCwd}")
except Exception as e:
    print(f"Warning: Could not change directory: {e}")

print(f"Python Script Running in: {os.getcwd()}")
print("-" * 40)

# 用户代码开始
${commandStr}
# 用户代码结束

print("")
print("-" * 40)
try:
    if sys.platform.startswith('win'):
        input("Press Enter to close...")
except:
    pass
`.trim();

        await writeTextFile(pyScriptPath, pyContent);

        // 2. 根据 OS 启动 Python
        if (osType === 'windows') {
            // 修复：移除手动引号和复杂的 & 链式命令
            // 直接传递路径，Tauri/Shell 会自动处理含空格路径的转义
            const cmd = Command.create('cmd', [
                '/c',
                'start',
                'CodeForge Python Executor', // 窗口标题
                'python',
                pyScriptPath
            ]);
            await cmd.spawn();

        } else if (osType === 'macos') {
            // macOS: 使用 osascript 打开 Terminal 运行 python3
            const launcherName = `codeforge_launcher_${timestamp}.sh`;
            const launcherPath = await join(baseDir, launcherName);

            // 创建一个临时的 sh 脚本来运行 python 并暂停
            // 使用 python3，并处理退出后的等待
            const shContent = `
#!/bin/bash
clear
python3 "${pyScriptPath}"
exit_code=$?
echo ""
echo "-----------------------------------"
echo "Process exited with code $exit_code"
read -n 1 -s -r -p "Press any key to close..."
rm "${pyScriptPath}"
rm "$0"
            `.trim();

            await writeTextFile(launcherPath, shContent);

            const appleScript = `
                tell application "Terminal"
                    activate
                    do script "sh '${launcherPath}'"
                end tell
            `;
            const cmd = Command.create('osascript', ['-e', appleScript]);
            await cmd.spawn();

        } else if (osType === 'linux') {
            // Linux: 使用 x-terminal-emulator
            // 直接构造 bash 命令串
            const bashCommand = `
python3 "${pyScriptPath}";
echo "";
echo "-----------------------------------";
read -p "Press Enter to close..."
rm "${pyScriptPath}"
            `.trim();

            const cmd = Command.create('x-terminal-emulator', [
                '-e',
                'bash',
                '-c',
                bashCommand
            ]);
            await cmd.spawn();
        }

        return; // Python 分支结束
    }

    // ========================================================================
    // 原有逻辑 (Windows PowerShell/Batch, macOS/Linux Bash) 保持不变
    // ========================================================================

    if (osType === 'windows') {
      if (shell === 'powershell') {
          // --- PowerShell 分支 ---
          const fileName = `codeforge_exec_${timestamp}.ps1`;
          const scriptPath = await join(baseDir, fileName);

          // 构建 PowerShell 脚本内容
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
