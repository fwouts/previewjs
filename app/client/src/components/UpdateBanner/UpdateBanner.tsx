import { webEndpoints } from "@previewjs/api";
import clsx from "clsx";
import React, { useCallback } from "react";
import { Link } from "..";

export const UpdateBanner = ({
  update,
  dismissedAt,
  onDismiss,
}: {
  update?: webEndpoints.UpdateAvailability;
  dismissedAt?: number;
  onDismiss(): void;
}) => {
  const dismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onDismiss();
    },
    [onDismiss]
  );
  if (!update?.available) {
    return null;
  }
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
