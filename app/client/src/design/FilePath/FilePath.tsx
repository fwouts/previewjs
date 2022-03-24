import React from "react";

export const FilePath = ({ filePath }: { filePath: string }) => {
  return (
    <div
      className="flex-grow text-left text-blue-100 truncate"
      style={{ direction: "rtl" }}
    >
      {filePath}
    </div>
  );
};
