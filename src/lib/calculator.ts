export function evaluateMath(input: string): string | null {
  // 移除开头的 = 号并清理空格
  let expr = input.replace(/^=/, '').trim().toLowerCase();
  if (!expr) return null;

  try {
    // 简单的安全检查：只允许数字、运算符、括号和特定数学关键词
    // 允许: 0-9, ., +, -, *, /, %, ^, (, ), pi, e, sin, cos, tan, sqrt, log, abs
    const allowedChars = /^[0-9+\-*/%^().\s a-z]+$/;
    if (!allowedChars.test(expr)) return null;

    // 替换常用数学函数和常量为 JS Math 对象属性
    // 注意替换顺序，避免像 'sin' 替换后变成 'Math.sin' 再被替换
    expr = expr
      .replace(/\^/g, '**')
      .replace(/pi/g, 'Math.PI')
      .replace(/e/g, 'Math.E')
      .replace(/sin/g, 'Math.sin')
      .replace(/cos/g, 'Math.cos')
      .replace(/tan/g, 'Math.tan')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/log/g, 'Math.log10')
      .replace(/ln/g, 'Math.log')
      .replace(/abs/g, 'Math.abs');

    // 使用 Function 构造器执行计算，这是一个相对安全的沙箱
    const func = new Function(`return ${expr};`);
    const result = func();

    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      // 处理精度问题，例如 0.1 + 0.2
      return parseFloat(result.toPrecision(12)).toString();
    }
  } catch (e) {
    return null;
  }
  return null;
}
