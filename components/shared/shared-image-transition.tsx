import { ViewTransition, type ReactNode } from "react";

export function SharedImageTransition({
  name,
  className,
  children,
}: {
  name: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition
      name={name}
      share="page-continuity-morph"
      default="none"
    >
      <div data-continuity-image={name} className={className}>
        {children}
      </div>
    </ViewTransition>
  );
}
