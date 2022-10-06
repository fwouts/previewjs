import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React, { Fragment } from "react";
import type { PreviewState } from "../../state/PreviewState";

export const Explorer = ({ state }: { state: PreviewState }) => {
  if (!state.project) {
    return (
      <div className="flex h-full items-center justify-center">
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
          for (let j = i; j < newFilePath.length - 1; j++) {
            display.push([
              newFilePath[j] + (j === newFilePath.length - 1 ? "" : "/"),
              j,
            ]);
          }
          currentFilePath = newFilePath;
          const fileName = newFilePath.at(-1)!;
          return (
            <Fragment key={filePath}>
              {display.map(([segment, indent], j) => (
                <div
                  key={filePath + "-" + segment}
                  className="px-2 py-1 whitespace-pre truncate font-normal text-sm bg-gray-400"
                  style={{ paddingLeft: indent + 0.5 + "rem" }}
                  title={newFilePath.slice(0, i + j + 1).join("/")}
                >
                  {segment}
                </div>
              ))}
              <div className="bg-white shadow-md rounded-lg border border-gray-200 m-2 p-2">
                <div className="whitespace-pre truncate font-medium text-sm mb-2">
                  {fileName}
                </div>
                <div className="flex flex-row flex-wrap gap-2">
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
                      onClick={() =>
                        state.setComponent(`${filePath}:${c.name}`)
                      }
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </Fragment>
          );
        }
      )}
    </>
  );
};
