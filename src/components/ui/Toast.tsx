import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'warning' | 'error' | 'info' | 'loading';

interface ToastProps {
  message: string;
  type?: ToastType; 
  show: boolean;
  onDismiss: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number; // 0 表示常驻
}

const ICONS = {
  success: <CheckCircle2 size={24} className="text-emerald-500" />,
  warning: <AlertTriangle size={24} className="text-amber-500" />,
  error: <XCircle size={24} className="text-rose-500" />,
  info: <Info size={24} className="text-blue-500" />,
  loading: <Loader2 size={24} className="text-primary animate-spin" />,
};

const ANIMATION_DURATION = 400;

export function Toast({ message, type = 'success', show, onDismiss, action, duration = 3000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (show) {
      // 1. 挂载到 DOM
      setShouldRender(true);
      
      // 2. 下一帧触发动画，确保过渡效果
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });

      // 3. 自动关闭逻辑
      if (duration > 0 && type !== 'loading') {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => triggerExit(), duration);
      }
    } else {
      triggerExit();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [show, duration, type]);

  const triggerExit = () => {
    setIsVisible(false);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      setShouldRender(false);
      onDismiss();
    }, ANIMATION_DURATION);
  };

  if (!shouldRender) return null;

  // 使用 createPortal 将组件渲染到 body 根节点，
  // 彻底解决被父组件 transform/overflow 属性影响导致“占满全屏”或定位错误的问题
  return createPortal(
    <div
      className={cn(
        // 定位与尺寸限制
        "fixed bottom-8 right-8 z-[9999] w-auto min-w-[320px] max-w-[420px]",
        // 视觉风格：毛玻璃、边框、圆角
        "bg-background/95 backdrop-blur-xl border border-border/60 rounded-2xl",
        // 阴影
        "shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]",
        // 动画状态
        "transition-all will-change-transform transform-gpu",
        isVisible 
          ? "opacity-100 translate-y-0 scale-100" 
          : "opacity-0 translate-y-4 scale-95"
      )}
      style={{
        transitionDuration: `${ANIMATION_DURATION}ms`,
        transitionTimingFunction: isVisible 
            ? 'cubic-bezier(0.23, 1, 0.32, 1)' 
            : 'cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div className="relative overflow-hidden rounded-2xl">
        {/* 内容容器 */}
        <div className="flex items-center gap-4 p-4 pr-10"> {/* pr-10 为关闭按钮留出空间 */}
            
            {/* 左侧图标：Flex 自动垂直居中 */}
            <div className="shrink-0 flex items-center justify-center animate-in zoom-in duration-300">
                {ICONS[type]}
            </div>
            
            {/* 右侧文字与按钮 */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug break-words">
                    {message}
                </p>

                {action && (
                    <div className="mt-2.5">
                        <button 
                            onClick={action.onClick}
                            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-md hover:bg-primary/90 transition-all shadow-sm active:scale-95"
                        >
                            {action.label}
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* 关闭按钮：绝对定位右上角 */}
        {duration === 0 && type !== 'loading' && (
            <button 
                onClick={triggerExit} 
                className="absolute top-2 right-2 p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/80 rounded-full transition-colors"
            >
                <X size={14} />
            </button>
        )}
        
        {/* 倒计时进度条 */}
        {isVisible && duration > 0 && type !== 'loading' && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-secondary/30">
                <div 
                    className={cn(
                        "h-full origin-left animate-[progress_linear_forwards]",
                        type === 'error' ? "bg-rose-500/50" : "bg-primary/50"
                    )}
                    style={{ animationDuration: `${duration}ms` }}
                />
            </div>
        )}
      </div>
      
      <style>{`
        @keyframes progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
      `}</style>
    </div>,
    document.body // 挂载目标
  );
}