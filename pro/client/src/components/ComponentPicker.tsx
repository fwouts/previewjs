import { faBook, faCode } from "@fortawesome/free-solid-svg-icons";
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
    );
  }
);
