import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useRef } from "react";

export const Container = (props: {
  children: React.ReactNode[];
  onClear(): void;
}) => {
  const scrollToBottomRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    scrollToBottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  });
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex flex-col overflow-y-auto">{props.children}</div>
      {props.children.length > 0 && (
        <button
          className="p-2 text-gray-400 border-t-2 border-gray-100 hover:text-gray-600"
          ref={scrollToBottomRef}
          onClick={props.onClear}
        >
          <FontAwesomeIcon icon={faTimesCircle} /> Clear all
        </button>
      )}
    </div>
  );
};
