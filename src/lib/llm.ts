import { AIProviderConfig } from "@/types/model";

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 通用的 SSE 流式请求处理函数
 * 兼容 OpenAI 格式 (DeepSeek 也是这个格式)
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  config: AIProviderConfig,
  onChunk: (delta: string) => void,
  onError: (err: string) => void,
  onFinish: () => void
) {
  try {
    if (!config.apiKey) {
      throw new Error("API Key not configured. Please go to Settings.");
    }

    // 1. 构建请求体
    const body = {
      model: config.modelId,
      messages: messages,
      stream: true, // ✨ 开启流式
      temperature: config.temperature,
    };

    // 2. 发起请求
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    if (!response.body) throw new Error("No response body");

    // 3. 处理流
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      const lines = buffer.split("\n");
      // 保留最后一个可能不完整的片段
      buffer = lines.pop() || ""; 

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        
        const dataStr = trimmed.replace("data: ", "");
        if (dataStr === "[DONE]") {
             // 流结束
             break;
        }

        try {
          const json = JSON.parse(dataStr);
          // OpenAI 格式: choices[0].delta.content
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            onChunk(delta);
          }
        } catch (e) {
          console.warn("Failed to parse SSE line", e);
        }
      }
    }

    onFinish();

  } catch (error: any) {
    console.error("LLM Request Failed:", error);
    onError(error.message || "Unknown error");
    onFinish();
  }
}