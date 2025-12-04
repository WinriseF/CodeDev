import { Command } from '@tauri-apps/plugin-shell';
import { type as getOsType } from '@tauri-apps/plugin-os';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { ShellType } from '@/types/prompt';

// 定义高风险命令关键词
const DANGEROUS_KEYWORDS = [
  'rm ', 'del ', 'remove-item',
  'mv ', 'move ',
  'format', 'mkfs',
  '>',
  'chmod ', 'chown ', 'icacls '
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
 * @param commandStr 要执行的命令
 * @param shell 用户指定的 Shell
 * @param cwd 可选的工作目录
 */
export async function executeCommand(commandStr: string, shell: ShellType = 'auto', cwd?: string | null) {
  // 安全审查
  if (checkCommandRisk(commandStr)) {
    const confirmed = await ask(
      `警告：此命令包含潜在的高风险操作 (如删除、覆盖、修改权限等)。\n\n命令: "${commandStr}"\n\n确定要继续执行吗？`,
      { title: '高风险操作确认', kind: 'warning', okLabel: '继续执行', cancelLabel: '取消' }
    );
    if (!confirmed) return;
  }

  const osType = await getOsType();
  let shellProcess: string;
  let shellArgs: string[];

  // 使用 switch 语句清晰地处理不同操作系统
  switch (osType) {
    case 'windows': {
      const effectiveShell = (shell === 'auto' || (shell !== 'cmd' && shell !== 'powershell')) ? 'powershell' : shell;
      if (effectiveShell === 'powershell') {
        shellProcess = 'powershell';
        const psCommand = cwd ? `Set-Location -Path '${cwd}'; ${commandStr}` : commandStr;
        // 在命令执行后添加 "pause" 效果
        shellArgs = ['-NoExit', '-Command', `& { ${psCommand}; Write-Host -NoNewLine "\\n--- [CodeForge] Command finished. Press any key to continue... ---"; $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null }`];
      } else { // cmd
        shellProcess = 'cmd';
        const cmdCommand = cwd ? `cd /d "${cwd}" && ${commandStr}` : commandStr;
        // & pause 会在新行显示 "请按任意键继续. . ."
        shellArgs = ['/k', `${cmdCommand} & echo. & pause`];
      }
      break;
    }

    case 'macos': {
      // 在 macOS 上，用户选择的 shell (bash/zsh) 很有意义
      const effectiveShell = (shell === 'auto' || shell === 'cmd' || shell === 'powershell') ? 'bash' : shell;
      // 将工作目录切换和命令执行串联起来
      const finalCommand = `${cwd ? `cd "${cwd}" && ` : ''}${commandStr}; echo; read -p "[CodeForge] Command finished. Press Enter to close."`;
      
      shellProcess = 'osascript';
      // 使用 AppleScript 来执行命令，并将 effectiveShell 作为参数
      const script = `
        tell application "Terminal"
          activate
          do script "exec ${effectiveShell} -c '${finalCommand.replace(/'/g, "'\\''")}'"
        end tell
      `;
      shellArgs = ['-e', script];
      break;
    }

    case 'linux': {
      const effectiveShell = (shell === 'auto' || shell === 'cmd' || shell === 'powershell') ? 'bash' : shell;
      const finalCommand = `${cwd ? `cd "${cwd}" && ` : ''}${commandStr}; echo; read -p "[CodeForge] Command finished. Press Enter to close."`;
      
      shellProcess = 'x-terminal-emulator'; 
      // -e 参数后直接跟要执行的命令
      shellArgs = ['-e', `${effectiveShell} -c "${finalCommand.replace(/"/g, '\\"')}"`];
      break;
    }

    default:
      await showNotification(`Unsupported OS: ${osType}`, "error");
      return;
  }

  try {
    console.log(`Executing in New Terminal: Process=${shellProcess}, Args=`, shellArgs);
    const command = Command.create(shellProcess, shellArgs);
    await command.spawn();
  } catch (e: any) {
    console.error("Failed to execute command:", e);
    if (osType === 'linux' && e.message?.includes('No such file or directory')) {
        await showNotification(`执行失败: 未找到 'x-terminal-emulator'。请尝试安装它或配置您的系统。`, "error");
    } else {
        await showNotification(`执行失败: ${e.message || e}`, "error");
    }
  }
}