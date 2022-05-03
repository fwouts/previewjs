import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useRef } from "react";

export const Container = (props: {
  children: React.ReactNode[];
  onClear(): void;
}) => {
  const scrollableContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!scrollableContainerRef.current) {
      return;
    }
    scrollableContainerRef.current.scroll({
      behavior: "smooth",
      top: scrollableContainerRef.current.scrollHeight,
    });
  });
  return (
    <div id="console-container" className="flex-grow flex flex-col min-h-0">
      <div
        ref={scrollableContainerRef}
        className="flex flex-col overflow-y-auto"
      >
        {props.children}
      </div>
      {props.children.length > 0 && (
        <button
          id="clear-console-button"
          className="p-2 text-gray-400 border-t-2 border-gray-100 hover:text-gray-600"
          onClick={props.onClear}
        >
          <FontAwesomeIcon icon={faTimesCircle} /> Clear all
        </button>
      )}
    </div>
  );
};
