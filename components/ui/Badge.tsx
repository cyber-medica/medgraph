import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
}

export default function Badge({
  children,
}: BadgeProps) {
  return (
    <span className="inline-flex rounded-md border border-[rgba(11,123,142,0.2)] bg-cm-teal-soft px-2.5 py-1 font-sans text-[10px] font-semibold text-cm-teal">
      {children}
    </span>
  );
}
