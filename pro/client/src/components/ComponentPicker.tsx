import { faBook, faCode, faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Selection } from "@previewjs/app/client/src/components/Selection";
import { PreviewState } from "@previewjs/app/client/src/PreviewState";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { ComponentButton } from "../design/ComponentButton";
import { ComponentList } from "../design/ComponentList";
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
      <>
        <button
          className="text-gray-100 hover:text-white hover:bg-gray-700 rounded-md text-lg px-2 py-2 mr-2 cursor-pointer"
          onClick={() => pro.toggleSearch()}
        >
          <FontAwesomeIcon icon={faSearch} fixedWidth />
        </button>
        <ComponentList loading={loading}>
          {components.map((component) => {
            const selected =
              component.componentId === preview.component?.componentId || false;
            const icon = component.type === "story" ? faBook : faCode;
            return selected ? (
              <Selection state={preview} icon={icon} ref={selectionRef} />
            ) : (
              <ComponentButton
                label={component.name}
                icon={icon}
                masked={!component.exported}
                onClick={() => preview.setComponent(component.componentId)}
              />
            );
          })}
        </ComponentList>
      </>
    );
  }
);
