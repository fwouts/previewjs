import clsx from "clsx";
import type React from "react";

const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-sm bg-gray-900 filter drop-shadow">{children}</div>
);

const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={clsx(["flex flex-row items-center p-2", className])}>
    {children}
  </div>
);

export const Header = Container as typeof Container & { Row: typeof Row };
Header.Row = Row;
