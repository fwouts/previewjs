import {
  faArrowsLeftRightToLine,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { ViewportState } from "../state/ViewportState";

export const ViewportZoomButtons = observer(
  ({ state }: { state: ViewportState }) => (
    <div className="flex flex-row rounded-md mx-2 p-0.5 border-2 border-gray-200">
      <Button
        title="Zoom in"
        icon={faMagnifyingGlassPlus}
        onClick={() => state.increaseOrDecreaseScale(+1)}
      />
      <Button
        title="Reset zoom to 100%"
        label={`${Math.round(state.currentScale * 100)}%`}
        onClick={() => state.setScale(1)}
      />
      <Button
        title="Zoom out"
        icon={faMagnifyingGlassMinus}
        onClick={() => state.increaseOrDecreaseScale(-1)}
      />
      {state.currentViewport.size && (
        <Button
          title="Fit to viewport"
          icon={faArrowsLeftRightToLine}
          rotate
          disabled={state.currentScale === state.scaleToFit}
          onClick={() => state.setScale(state.scaleToFit)}
        />
      )}
    </div>
  )
);

const Button = (
  props: {
    title: string;
    onClick(): void;
    rotate?: boolean;
    disabled?: boolean;
  } & ({ icon: IconDefinition } | { label: string })
) => (
  <button
    className={clsx(
      ["self-stretch px-2"],
      props.rotate && "rotate-45",
      props.disabled
        ? "text-gray-300"
        : "cursor-pointer text-gray-600 hover:text-black"
    )}
    title={props.title}
    onClick={props.onClick}
    disabled={props.disabled}
  >
    {"icon" in props ? (
      <FontAwesomeIcon icon={props.icon} />
    ) : (
      <span className="text-sm grid place-self-center w-8">{props.label}</span>
    )}
  </button>
);
