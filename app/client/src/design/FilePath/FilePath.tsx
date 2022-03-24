import { faFileCode } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";

export const FilePath = ({ filePath }: { filePath: string }) => {
  return (
    <div className="truncate flex flex-row items-center px-2 py-1 bg-gray-100 text-gray-800 rounded-md">
      <div className="mr-2">
        <FontAwesomeIcon icon={faFileCode} />
      </div>
      <div className="text-left truncate" style={{ direction: "rtl" }}>
        {filePath}
      </div>
    </div>
  );
};
