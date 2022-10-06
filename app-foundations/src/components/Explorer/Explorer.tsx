import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React from "react";
import type { PreviewState } from "../../state/PreviewState";

export const Explorer = ({ state }: { state: PreviewState }) => {
  if (!state.project) {
    return (
      <div className="self-center flex-grow flex flex-col justify-center">
        <FontAwesomeIcon
          icon={faSpinner}
          className="text-6xl animate-spin text-gray-800"
        />
      </div>
    );
  }

  let currentFilePath: string[] = [];
  return (
    <>
      {Object.entries(state.project.components).map(
        ([filePath, components]) => {
          const filteredComponents = components.filter(
            (c) => c.info.kind === "story" || c.info.exported
          );
          if (filteredComponents.length === 0) {
            return null;
          }
          const newFilePath = filePath.split("/");
          let i = 0;
          while (
            i < currentFilePath.length &&
            i < newFilePath.length &&
            currentFilePath[i] === newFilePath[i]
          ) {
            i++;
          }
          const display: [string, number][] = [];
          for (let j = i; j < newFilePath.length; j++) {
            display.push([
              newFilePath[j] + (j === newFilePath.length - 1 ? "" : "/"),
              j,
            ]);
          }
          currentFilePath = newFilePath;
          return (
            <div key={filePath}>
              {display.map(([segment, indent], i) => (
                <div
                  key={filePath + "-" + segment}
                  className={clsx(
                    "px-2 py-1 whitespace-pre truncate",
                    i === display.length - 1
                      ? "font-medium bg-gray-100"
                      : "font-normal bg-gray-400"
                  )}
                  style={{ paddingLeft: indent + 0.5 + "rem" }}
                  title={segment}
                >
                  {segment}
                </div>
              ))}
              <div className="flex flex-row flex-wrap gap-2 px-1 py-2 bg-gray-200">
                {filteredComponents.map((c) => (
                  <button
                    key={c.name}
                    className={clsx(
                      "rounded-full py-1 px-2 text-sm",
                      `${filePath}:${c.name}` === state.component?.componentId
                        ? "bg-gray-800 text-white"
                        : c.info.kind === "component"
                        ? "bg-blue-300 text-blue-900 hover:bg-blue-500 hover:text-white"
                        : "bg-pink-300 text-pink-900 hover:bg-pink-500 hover:text-white"
                    )}
                    onClick={() => state.setComponent(`${filePath}:${c.name}`)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          );
        }
      )}
    </>
  );
};
