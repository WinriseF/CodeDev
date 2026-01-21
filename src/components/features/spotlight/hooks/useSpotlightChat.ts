import { useState, useRef, useCallback } from 'react';
import { ChatMessage, streamChatCompletion } from '@/lib/llm';
import { useAppStore } from '@/store/useAppStore';
import { useSpotlight } from '../core/SpotlightContext';
// [New] 引入组装函数
import { assembleChatPrompt } from '@/lib/template';

export function useSpotlightChat() {
  const { chatInput, setChatInput, activeTemplate, setActiveTemplate } = useSpotlight(); // [New] 获取模板状态
  const { aiConfig: uiAiConfig, setAIConfig } = useAppStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 发送消息
  const sendMessage = useCallback(async () => {
    // [New] 智能组装逻辑
    // 如果有激活的模板，使用 assembleChatPrompt；否则使用原始输入
    let finalContent = chatInput.trim();

    // 如果是模板模式，允许空输入(直发模式)，否则必须非空
    if (activeTemplate) {
        finalContent = assembleChatPrompt(activeTemplate.content, chatInput);
    } else {
        if (!finalContent) return;
    }

    if (isStreaming) return;
    if (!finalContent) return; // 双重检查

    const freshConfig = useAppStore.getState().aiConfig;

    if (!freshConfig.apiKey) {
       setMessages(prev => [...prev, {
           role: 'assistant',
           content: `**Configuration Error**: API Key is missing. \n\nPlease go to Settings (in the main window) -> AI Configuration to set it up.`,
           reasoning: ''
       }]);
       return;
    }

    // [New] 重置状态：清空输入框 + 清除激活的模板
    setChatInput('');
    setActiveTemplate(null);

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: finalContent }];
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
  }, [chatInput, isStreaming, messages, activeTemplate, setActiveTemplate, setChatInput]); // [New] 添加依赖

  const clearChat = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    setChatInput('');
    setActiveTemplate(null); // [New] 清空时也重置模板
  }, [isStreaming, setChatInput, setActiveTemplate]);

  const cycleProvider = useCallback(() => {
    const currentSettings = useAppStore.getState().savedProviderSettings;
    const providers = Object.keys(currentSettings);
    const currentProvider = useAppStore.getState().aiConfig.providerId;

    if (providers.length > 0) {
        const currentIndex = providers.indexOf(currentProvider);
        const nextIndex = (currentIndex + 1) % providers.length;
        setAIConfig({ providerId: providers[nextIndex] });
    }
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
