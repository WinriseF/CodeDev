const ALLOWED_CHARS_REGEX = /^[0-9+\-*/%^().\s a-z]+$/;

export function evaluateMath(input: string): string | null {
  // 移除开头的 = 号并清理空格
  let expr = input.replace(/^=/, '').trim().toLowerCase();
  if (!expr) return null;

  try {
    // 使用静态正则
    if (!ALLOWED_CHARS_REGEX.test(expr)) return null;

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

    const func = new Function(`return ${expr};`);
    const result = func();

    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      const rounded = parseFloat(result.toPrecision(12));

      // 阈值清洗：极小值视为 0
      if (Math.abs(rounded) < 1e-10) {
        return '0';
      }

      // 限制最大字符长度，防止超长浮点数撑爆 UI
      const strRes = rounded.toString();
      if (strRes.length > 20) {
        return result.toExponential(4);
      }

      return strRes;
    }
  } catch (e) {
    return null;
  }
  return null;
}
