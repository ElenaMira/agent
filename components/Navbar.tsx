"use client";

import { cn } from "@/utils/cn";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Link from "next/link";

export const ActiveLink = (props: { href: string; children: ReactNode }) => {
   // 获取当前页面的路径
  const pathname = usePathname();
  return (
    <Link
      // 目标页面
      href={props.href}
      //通过不同的样式选择来反应当前的页面是否为目标页面同一个页面)
      className={cn(
        //基础样式
        "px-4 py-2 rounded-[18px] whitespace-nowrap flex items-center gap-2 text-sm transition-all",
        // 条件样式：如果当前路径等于链接路径,则添加背景颜色和文字颜色(表示以及切换到目标页面)
        pathname === props.href && "bg-primary text-primary-foreground",
      )}
    >
      {/* React Props 系统 */}
      {props.children}
    </Link>
  );
};
