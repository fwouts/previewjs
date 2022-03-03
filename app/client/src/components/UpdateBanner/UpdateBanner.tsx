import clsx from "clsx";
import React, { useCallback } from "react";
import { Link, PreviewState } from "..";

export const UpdateBanner = ({ state }: { state: PreviewState }) => {
  const dismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      state.onUpdateDismissed();
    },
    [state.onUpdateDismissed]
  );
  const update = state.checkVersionResponse?.update;
  if (!update?.available || !state.persistedState) {
    return null;
  }
  const dismissedAt = state.persistedState.updateDismissed?.timestamp;
  if (
    !update.required &&
    dismissedAt &&
    Date.now() < dismissedAt + 24 * 60 * 60 * 1000
  ) {
    return null;
  }
  return (
    <Link
      className={clsx([
        "flex flex-row items-center px-2 py-1",
        update.required ? "bg-red-300" : "bg-blue-300",
      ])}
      href={update.url}
    >
      <div className="m-2">{update.bannerMessage}</div>
      <div className="flex-grow"></div>
      <button
        className={clsx([
          "px-2 py-1 rounded-md font-bold",
          update.required ? "bg-red-50" : "bg-blue-50",
        ])}
      >
        Update now
      </button>
      {!update.required && (
        <button className="ml-1 px-2 py-1" onClick={dismiss}>
          Dismiss
        </button>
      )}
    </Link>
  );
};
