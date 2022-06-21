import React from "react";

export const Container: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div className="absolute overflow-hidden bottom-0 right-0 z-50">
      {children}
    </div>
  );
};
