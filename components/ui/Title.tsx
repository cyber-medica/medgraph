import { ReactNode } from "react";

interface TitleProps {
  children: ReactNode;
}

export default function Title({
  children,
}: TitleProps) {
  return (
    <h2 className="cm-heading-2 text-2xl font-extrabold sm:text-3xl">
      {children}
    </h2>
  );
}
