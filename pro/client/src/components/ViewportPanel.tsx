import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { ViewportState } from "../state/ViewportState";

export const ViewportPanel = observer(({ state }: { state: ViewportState }) => {
  return (
    <div className="flex-grow overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-2">
        {state.options.map((viewport) => (
          <button
            key={viewport.id}
            className={clsx([
              "flex flex-row items-center p-3 m-2 cursor-pointer filter drop-shadow-sm",
              viewport.id === state.currentViewport.id
                ? "bg-blue-200 text-blue-900"
                : "bg-gray-50 text-gray-900",
            ])}
            onClick={() => {
              state.setViewportId(viewport.id);
            }}
          >
            <div className="mr-2">
              <FontAwesomeIcon
                icon={viewport.icon}
                rotation={viewport.rotateIcon ? 90 : undefined}
              />
            </div>
            <div className="flex-grow text-left">{viewport.label}</div>
            {viewport.id === "custom" &&
            state.currentViewport.id === "custom" ? (
              <div className="flex flex-row">
                <input
                  type="number"
                  className="w-20 text-center rounded-md bg-blue-50"
                  value={viewport.size?.width}
                  onChange={(e) =>
                    state.updateCustomViewport({
                      width: parseInt(e.target.value),
                    })
                  }
                />
                <div className="mx-1">x</div>
                <input
                  type="number"
                  className="w-20 text-center rounded-md bg-blue-50"
                  value={viewport.size?.height}
                  onChange={(e) =>
                    state.updateCustomViewport({
                      height: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            ) : (
              viewport.size && (
                <div
                  className={clsx([
                    "ml-2 text-sm font-semibold",
                    viewport.id === state.currentViewport.id
                      ? "text-blue-800"
                      : "text-gray-500",
                  ])}
                >
                  {viewport.size.width}x{viewport.size.height}
                </div>
              )
            )}
          </button>
        ))}
      </div>
    </div>
  );
});
