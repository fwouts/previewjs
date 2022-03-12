import { Preview } from "@previewjs/app/client/src/components/Preview";
import { Selection } from "@previewjs/app/client/src/components/Selection";
import { observer } from "mobx-react-lite";
import React from "react";
import { AppState } from "../state/AppState";

export const MainPanel = observer(
  ({ state: { preview } }: { state: AppState }) => {
    return (
      <Preview
        state={preview}
        subheader={preview.component && <Selection state={preview} />}
      />
    );
  }
);
