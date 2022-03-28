import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";

export const ComponentList: React.FC<{ loading?: boolean }> = ({
  children,
  loading,
}) => (
  <div
    id="component-list"
    className="flex flex-row items-center overflow-x-auto scrollbar-hidden select-none"
  >
    {children}
    {loading && (
      <div className="p-2">
        <FontAwesomeIcon
          icon={faSpinner}
          className="text-gray-800 animate-spin"
        />
      </div>
    )}
  </div>
);
