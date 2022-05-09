import React from "react";

export const ActionsContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <>
    <div className="p-4 flex flex-row gap-2 flex-wrap justify-around bg-gray-900">
      {children}
    </div>
  </>
);
