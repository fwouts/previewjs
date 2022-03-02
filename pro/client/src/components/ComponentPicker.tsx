import {
  faBookReader,
  faCamera,
  faCode,
  faDotCircle,
  faSpinner,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  PreviewState,
  SelectedComponent,
} from "@previewjs/app/client/src/components";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { ProState } from "../state/ProState";

export const ComponentPicker = observer(
  ({ pro, preview }: { pro: ProState; preview: PreviewState }) => {
    const loading = pro.currentFile?.loading || false;
    const components = pro.currentFile?.components || [];
    const currentRelativeFilePath = pro.currentFile?.filePath || null;

    const componentRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
      componentRef.current?.scrollIntoView({
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
          // TODO: Change this, should be checking against key which includes relative file path.
          const selected = component.key === preview.component?.name || false;
          let label = component.label;
          let icon: IconDefinition | undefined;
          if (label.startsWith("stories:")) {
            label = label.substring("stories:".length);
            icon = faBookReader;
          } else if (label.startsWith("story:")) {
            label = label.substring("story:".length);
            icon = faBookReader;
          } else if (label.startsWith("screenshot:")) {
            label = label.substring("screenshot:".length);
            icon = faCamera;
          } else if (component.exported) {
            icon = faDotCircle;
          }
          const componentPath = `${currentRelativeFilePath}:${component.key}`;
          return selected ? (
            <SelectedComponent state={preview} icon={icon} label={label} />
          ) : (
            <button
              className="component inline-flex items-center shrink-0 text-gray-300 mx-5"
              key={componentPath}
              onClick={() => preview.setComponent(componentPath)}
              ref={selected ? componentRef : null}
            >
              <FontAwesomeIcon
                icon={icon || faCode}
                fixedWidth
                className="mr-2"
              />
              {label}
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
