import React from "react";

export const ActionsContainer: React.FC = ({ children }) => (
  <>
    <div className="p-4 flex flex-row gap-2 flex-wrap justify-between bg-gray-900">
      {children}
    </div>
  </>
);
