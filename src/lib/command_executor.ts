import { Command } from '@tauri-apps/plugin-shell';
import { type as getOsType } from '@tauri-apps/plugin-os';
import { message } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { join, tempDir } from '@tauri-apps/api/path';
import { ShellType } from '@/types/prompt';
import { useConfirmStore } from '@/store/useConfirmStore';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';

const DANGEROUS_KEYWORDS = [
  'rm ', 'del ', 'remove-item', 'mv ', 'move ', 'format', 'mkfs', '>', 'chmod ', 'chown ', 'icacls '
];

const checkCommandRisk = (commandStr: string): boolean => {
  const lowerCaseCmd = commandStr.toLowerCase().trim();
  return DANGEROUS_KEYWORDS.some(keyword => {
    if (keyword === '>') return lowerCaseCmd.includes('>');
    return new RegExp(`\\b${keyword}`).test(lowerCaseCmd);
  });
};

const showNotification = async (msg: string, type: 'info' | 'error' = 'info') => {
  await message(msg, { title: 'CtxRun', kind: type });
};

export async function executeCommand(commandStr: string, shell: ShellType = 'auto', cwd?: string | null) {
  const language = useAppStore.getState().language;

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

    if (shell === 'python') {
        const pyFileName = `ctxrun_script_${timestamp}.py`;
        const pyScriptPath = await join(baseDir, pyFileName);

        const pyContent = `
import os
import sys
import io

if sys.platform.startswith('win'):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    except:
        pass

try:
    os.chdir(r"${cleanCwd}")
except Exception as e:
    print(f"Warning: Could not change directory: {e}")

print(f"Python Script Running in: {os.getcwd()}")
print("-" * 40)

${commandStr}

print("")
print("-" * 40)
try:
    if sys.platform.startswith('win'):
        input("Press Enter to close...")
except:
    pass
`.trim();

        await writeTextFile(pyScriptPath, pyContent);

        if (osType === 'windows') {
            const cmd = Command.create('cmd', [
                '/c',
                'start',
                'CtxRun Python Executor',
                'python',
                pyScriptPath
            ]);
            await cmd.spawn();

        } else if (osType === 'macos') {
            const launcherName = `ctxrun_launcher_${timestamp}.sh`;
            const launcherPath = await join(baseDir, launcherName);

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

        return;
    }

    if (osType === 'windows') {
      if (shell === 'powershell') {
          const fileName = `ctxrun_exec_${timestamp}.ps1`;
          const scriptPath = await join(baseDir, fileName);

          const psContent = `
Set-Location -Path "${cleanCwd}"
Clear-Host
Write-Host "Windows PowerShell (CtxRun)" -ForegroundColor Cyan
Write-Host "-----------------------------------"
Write-Host ""

${commandStr}

Write-Host ""
Write-Host "-----------------------------------"
Read-Host -Prompt "Press Enter to close"
Remove-Item -Path $MyInvocation.MyCommand.Path -Force
`.trim();

          await writeTextFile(scriptPath, psContent);

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
          const fileName = `ctxrun_exec_${timestamp}.bat`;
          const scriptPath = await join(baseDir, fileName);

          const fileContent = `
@echo off
cd /d "${cleanCwd}"
cls
ver
echo (c) Microsoft Corporation. All rights reserved.
echo.

@echo on
${commandStr}
@echo off

echo.
pause
start /b "" cmd /c del "%~f0"&exit /b
        `.trim();

          await writeTextFile(scriptPath, fileContent);

          const cmd = Command.create('cmd', ['/c', 'start', '', scriptPath]);
          await cmd.spawn();
      }

    } else if (osType === 'macos') {
      const fileName = `ctxrun_exec_${timestamp}.sh`;
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

      const appleScript = `
        tell application "Terminal"
          activate
          do script "sh '${scriptPath}'"
        end tell
      `;
      const cmd = Command.create('osascript', ['-e', appleScript]);
      await cmd.spawn();

    } else if (osType === 'linux') {
      const fileName = `ctxrun_exec_${timestamp}.sh`;
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
