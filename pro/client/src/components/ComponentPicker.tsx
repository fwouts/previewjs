import styled from "@emotion/styled";
import {
  faBookReader,
  faCamera,
  faDotCircle,
  faSpinner,
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
    const currentRelativeFilePath = pro.currentFile?.relativeFilePath || null;

    const componentRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      componentRef.current?.scrollIntoView({
        block: "end",
        inline: "start",
        behavior: "smooth",
      });
    }, [preview.component?.componentId, loading]);
    return (
      <ComponentList id="component-list">
        {components.map((component) => {
          // TODO: Change this, should be checking against key which includes relative file path.
          const selected = component.key === preview.component?.name || false;
          let label = component.label;
          let icon: React.ReactElement | null = null;
          if (label.startsWith("stories:")) {
            label = label.substr("stories:".length);
            icon = <ComponentTypeIcon icon={faBookReader} />;
          } else if (label.startsWith("story:")) {
            label = label.substr("story:".length);
            icon = <ComponentTypeIcon icon={faBookReader} />;
          } else if (label.startsWith("screenshot:")) {
            label = label.substr("screenshot:".length);
            icon = <ComponentTypeIcon icon={faCamera} />;
          } else if (component.exported) {
            icon = <ComponentTypeIcon icon={faDotCircle} />;
          }
          const componentPath = `${currentRelativeFilePath}:${component.key}`;
          return selected ? (
            <SelectedComponent
              state={preview}
              label={
                <>
                  {icon}
                  {label}
                </>
              }
            />
          ) : (
            <ComponentItem
              key={componentPath}
              onClick={() => preview.setComponent(componentPath)}
              ref={selected ? componentRef : null}
            >
              <ComponentLabel className="component">
                {icon}
                {label}
              </ComponentLabel>
            </ComponentItem>
          );
        })}
        {loading && <FullSpinnerIcon icon={faSpinner} spin />}
      </ComponentList>
    );
  }
);

const FullSpinnerIcon = styled(FontAwesomeIcon)`
  color: hsl(213, 30%, 80%);
  padding: 8px 0;
`;

const ComponentList = styled.div`
  display: flex;
  overflow-x: auto;
  align-items: center;
  user-select: none;

  -ms-overflow-style: none; /* Internet Explorer 10+ */
  scrollbar-width: none; /* Firefox */
  &::-webkit-scrollbar {
    display: none; /* Safari and Chrome */
  }
`;

const ComponentItem = styled.div`
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 16px;
  margin-right: 8px;
  color: hsl(213, 20%, 70%);
  font-size: 1rem;
  &:hover {
    background: hsl(213, 40%, 40%);
    color: hsl(213, 30%, 80%);
  }
`;

const ComponentTypeIcon = styled(FontAwesomeIcon)`
  margin-right: 8px;
`;

const ComponentLabel = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 2px 0;
`;
