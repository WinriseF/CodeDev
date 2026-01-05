import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, streamChatCompletion } from '@/lib/llm';
import { useAppStore } from '@/store/useAppStore';
import { useSpotlight } from '../core/SpotlightContext';

export function useSpotlightChat() {
  const { chatInput, setChatInput, mode } = useSpotlight();
  // 只用于 UI 显示当前 provider，不用于发送逻辑
  const { aiConfig: uiAiConfig, setAIConfig } = useAppStore(); 
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (mode === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, mode, isStreaming, messages[messages.length-1]?.content]);

  // 发送消息
  // 使用 useCallback 确保函数引用稳定，但在内部使用 getState() 获取最新配置
  const sendMessage = useCallback(async () => {
    // 1. 直接获取最新状态，避免闭包陷阱
    const currentInput = chatInput.trim(); 
    if (!currentInput || isStreaming) return;
    
    // 2. 关键修复：直接从 Store 获取最新的 AI 配置，而不是依赖组件渲染时的 aiConfig
    const freshConfig = useAppStore.getState().aiConfig;

    // 检查 Key 是否为空
    if (!freshConfig.apiKey) {
       setMessages(prev => [...prev, { 
           role: 'assistant', 
           content: `**Configuration Error**: API Key is missing. \n\nPlease go to Settings (in the main window) -> AI Configuration to set it up.`,
           reasoning: ''
       }]);
       return;
    }
    
    setChatInput(''); // 清空 Context 中的输入
    
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: currentInput }];
    setMessages(newMessages);
    setIsStreaming(true);
    
    // 添加空的助手消息占位
    setMessages(prev => [...prev, { role: 'assistant', content: '', reasoning: '' }]);

    await streamChatCompletion(newMessages, freshConfig,
      (contentDelta, reasoningDelta) => {
        setMessages(current => {
          const updated = [...current];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            updated[updated.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + contentDelta,
              reasoning: (lastMsg.reasoning || "") + reasoningDelta
            };
          }
          return updated;
        });
      },
      (err) => {
        setMessages(current => {
          const updated = [...current];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg) {
            updated[updated.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + `\n\n**[Error]**: ${err}`
            };
          }
          return updated;
        });
      },
      () => setIsStreaming(false)
    );
  }, [chatInput, isStreaming, messages]); // 依赖项

  const clearChat = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    setChatInput('');
  }, [isStreaming, setChatInput]);

  const cycleProvider = useCallback(() => {
    // 这里使用 useAppStore.getState() 也是安全的，但用 hook 里的也没问题
    const currentProvider = useAppStore.getState().aiConfig.providerId;
    const providers: Array<'openai' | 'deepseek' | 'anthropic'> = ['deepseek', 'openai', 'anthropic'];
    const currentIndex = providers.indexOf(currentProvider);
    const nextIndex = (currentIndex + 1) % providers.length;
    setAIConfig({ providerId: providers[nextIndex] });
  }, [setAIConfig]);

  return {
    messages,
    isStreaming,
    chatEndRef,
    sendMessage,
    clearChat,
    cycleProvider,
    providerId: uiAiConfig.providerId // 用于 UI 显示
  };
}