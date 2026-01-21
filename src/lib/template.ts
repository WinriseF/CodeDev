/**
 * 解析文本中的变量，例如 "git commit -m '{{message}}'" -> ["message"]
 * 支持去重
 */
export function parseVariables(template: string): string[] {
  const regex = /\{\{\s*(.+?)\s*\}\}/g;
  const vars = new Set<string>();
  let match;

  while ((match = regex.exec(template)) !== null) {
    vars.add(match[1]);
  }

  return Array.from(vars);
}

/**
 * 填充模板
 * @param template 原始字符串 "{{name}} says hello"
 * @param values 键值对 { name: "World" }
 * @returns "World says hello"
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, key) => {
    const val = values[key];
    return val !== undefined ? val : _;
  });
}

/**
 * 智能组装聊天指令
 * @param template Prompt 模板内容
 * @param userInput 用户输入的参数
 * @returns 组装后的最终内容
 */
export function assembleChatPrompt(template: string, userInput: string): string {
  const vars = parseVariables(template);
  const cleanInput = userInput.trim();

  // 场景 A: 填空模式 (模板包含 {{变量}})
  if (vars.length > 0) {
    // 简单起见，将用户输入填充给所有变量
    const values: Record<string, string> = {};
    vars.forEach(v => {
      values[v] = cleanInput;
    });
    return fillTemplate(template, values);
  }

  // 场景 B: 拼接模式 (无变量，但有输入)
  if (cleanInput) {
    return `${template}\n\n${cleanInput}`;
  }

  // 场景 C: 直发模式 (无变量，无输入)
  return template;
}