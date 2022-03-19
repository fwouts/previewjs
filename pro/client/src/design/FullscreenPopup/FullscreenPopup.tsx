import React from "react";

export const FullscreenPopup: React.FC<{ onClose(): void }> = ({
  children,
  onClose,
}) => (
  <div
    className="fixed inset-0 w-screen h-screen grid place-items-center z-50 bg-gray-700 bg-opacity-50 filter backdrop-blur"
    onClick={onClose}
  >
    <div
      className="bg-gray-50 rounded-md filter drop-shadow m-4"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);
