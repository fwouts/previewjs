import React from "react";

export const FilePath = ({ filePath }: { filePath: string }) => {
  const segments = filePath.split(/[/\\]/);
  return (
    <div className="flex-grow flex flex-row flex-wrap text-blue-100">
      {segments.map((segment, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="mx-1">/</span>}
          <span className="whitespace-nowrap">{segment}</span>
        </React.Fragment>
      ))}
    </div>
  );
};
