import { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function GuideInfoBox(props: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-[768px] rounded-2xl border border-input bg-secondary/60 p-6 text-sm text-foreground",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
