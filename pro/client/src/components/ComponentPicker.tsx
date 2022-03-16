import { faBook, faCode, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Selection } from "@previewjs/app/client/src/components/Selection";
import { PreviewState } from "@previewjs/app/client/src/PreviewState";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { ProState } from "../state/ProState";

export const ComponentPicker = observer(
  ({ pro, preview }: { pro: ProState; preview: PreviewState }) => {
    const loading = pro.currentFile?.loading || false;
    const components = pro.currentFile?.components || [];
    const selectionRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      selectionRef.current?.scrollIntoView({
        block: "end",
        inline: "start",
        behavior: "smooth",
      });
    }, [preview.component?.componentId, loading]);
    return (
      <div
        id="component-list"
        className="flex flex-row items-center overflow-x-auto scrollbar-hidden select-none"
      >
        {components.map((component) => {
          const selected =
            component.componentId === preview.component?.componentId || false;
          const icon = component.type === "story" ? faBook : faCode;
          return selected ? (
            <Selection state={preview} icon={icon} ref={selectionRef} />
          ) : (
            <button
              className={clsx([
                "component inline-flex items-center shrink-0 text-gray-200 mx-5",
                !component.exported && "text-gray-500",
              ])}
              key={component.componentId}
              onClick={() => preview.setComponent(component.componentId)}
            >
              <FontAwesomeIcon
                icon={icon || faCode}
                fixedWidth
                className="mr-2"
              />
              {component.name}
            </button>
          );
        })}
        {loading && (
          <FontAwesomeIcon
            icon={faSpinner}
            className="text-gray-300 animate-spin"
          />
        )}
      </div>
    );
  }
);
