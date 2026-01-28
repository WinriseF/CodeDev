import React from 'react';
import { SiBaidu, SiGoogle } from "react-icons/si";
import { BsBing } from "react-icons/bs";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchEngineType = 'google' | 'bing' | 'baidu' | 'custom';

interface SearchEngineIconProps {
  engine: SearchEngineType | string;
  size?: number;
  className?: string;
  /** 是否使用品牌原色，通常在非选中状态或设置面板中使用 */
  colorize?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  google: SiGoogle,
  bing: BsBing,
  baidu: SiBaidu,
  custom: Search,
};

const COLOR_MAP: Record<string, string> = {
  google: "text-[#4285F4]",
  bing: "text-[#008373]",
  baidu: "text-[#2932E1]",
  custom: "text-purple-500",
};

export function SearchEngineIcon({
  engine,
  size = 18,
  className,
  colorize = true
}: SearchEngineIconProps) {
  const IconComponent = ICON_MAP[engine] || Search;
  const brandColor = colorize ? (COLOR_MAP[engine] || "text-muted-foreground") : "";

  return (
    <IconComponent
      size={size}
      className={cn(brandColor, className)}
    />
  );
}
