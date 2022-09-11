import { faGithub, faTwitter } from "@fortawesome/free-brands-svg-icons";
import {
  faCircleXmark,
  faCode,
  faExternalLink,
  faSpinner,
  faTerminal,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  CollectedTypes,
  namedType,
  UNKNOWN_TYPE,
  ValueType,
} from "@previewjs/type-analyzer";
import { useWindowHeight } from "@react-hook/window-size";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React, { Fragment } from "react";
import { FilePath } from "../../design/FilePath";
import { Header } from "../../design/Header";
import { Link } from "../../design/Link";
import { PropsEditor } from "../../design/PropsEditor";
import { SmallLogo } from "../../design/SmallLogo";
import { PanelTab, TabbedPanel } from "../../design/TabbedPanel";
import { decodeComponentId } from "../../state/component-id";
import { generatePropsTypeDeclarations } from "../../state/generators/generate-type-declarations";
import type { PreviewState } from "../../state/PreviewState";
import { ActionLogs } from "../ActionLogs";
import { ConsolePanel } from "../ConsolePanel";
import { UpdateBanner } from "../UpdateBanner";

export const Preview = observer(
  ({
    state,
    appLabel,
    headerAddon,
    subheader,
    footer,
    panelTabs,
    PropsPanel = DefaultPropsPanel,
    viewport,
  }: {
    state: PreviewState;
    appLabel: string;
    headerAddon?: React.ReactNode;
    subheader?: React.ReactNode;
    footer?: React.ReactNode;
    panelTabs?: PanelTab[];
    PropsPanel?: React.ComponentType<PropsPanelProps>;
    viewport: React.ReactNode;
  }) => {
    const panelHeight = useWindowHeight() * 0.3;

    if (!state.reachable) {
      return (
        <div className="h-screen bg-gray-700 text-gray-100 p-2 grid place-items-center text-lg">
          <div
            id="app-error"
            className="p-4 rounded-lg text-red-800 bg-red-50 filter drop-shadow-lg"
          >
            Server disconnected. Is Preview.js still running?
          </div>
        </div>
      );
    }

    const tabs: PanelTab[] = [];

    if (state.component) {
      if (
        (state.component.variantKey === null ||
          state.component.variantKey === "custom") &&
        state.component.details
      ) {
        const { props } = state.component.details;
        const { propsTypeName, types } = props.propsType;
        const propsType = types[propsTypeName]?.type || UNKNOWN_TYPE;
        const isEmptyProps =
          propsType.kind === "object" &&
          Object.entries(propsType.fields).length === 0;

        if (!isEmptyProps) {
          tabs.push({
            label: "Properties",
            key: "props",
            icon: faCode,
            notificationCount: 0,
            panel: (
              <PropsPanel
                componentName={state.component.name}
                propsType={namedType(propsTypeName)}
                types={types}
                source={props.invocationSource}
                onChange={state.updateProps.bind(state)}
                onReset={
                  props.isDefaultInvocationSource
                    ? undefined
                    : state.resetProps.bind(state)
                }
                codeEditor={
                  <PropsEditor
                    documentId={state.component.componentId}
                    onUpdate={state.updateProps.bind(state)}
                    source={props.invocationSource}
                    typeDeclarationsSource={generatePropsTypeDeclarations(
                      propsTypeName,
                      types
                    )}
                  />
                }
              />
            ),
          });
        }
      }

      tabs.push({
        label: "Console",
        key: "console",
        icon: faTerminal,
        notificationCount: state.consoleLogs.unreadCount,
        panel: <ConsolePanel state={state.consoleLogs} />,
      });
    }

    if (panelTabs) {
      tabs.push(...panelTabs);
    }

    return (
      <div className="flex flex-row flex-grow min-h-0">
        <div className="w-1/4 bg-gray-600 flex flex-col h-screen overflow-auto">
          {state.project ? (
            (() => {
              let currentFilePath: string[] = [];
              return Object.entries(state.project.components).map(
                ([filePath, components]) => {
                  const newFilePath = filePath.split("/");
                  let i = 0;
                  while (
                    i < currentFilePath.length &&
                    i < newFilePath.length &&
                    currentFilePath[i] === newFilePath[i]
                  ) {
                    i++;
                  }
                  const display: [string, number][] = [];
                  for (let j = i; j < newFilePath.length; j++) {
                    display.push([
                      newFilePath[j] +
                        (j === newFilePath.length - 1 ? "" : "/"),
                      j,
                    ]);
                  }
                  currentFilePath = newFilePath;
                  return (
                    <div key={filePath}>
                      {display.map(([segment, indent], i) => (
                        <div
                          key={filePath + "-" + segment}
                          className={clsx(
                            "px-2 py-1 whitespace-pre truncate",
                            i === display.length - 1
                              ? "font-medium bg-gray-100"
                              : "font-normal bg-gray-400"
                          )}
                          style={{ paddingLeft: indent + 0.5 + "rem" }}
                          title={segment}
                        >
                          {segment}
                        </div>
                      ))}
                      <div
                        className="flex flex-row flex-wrap gap-2 px-2 py-2 bg-gray-200"
                        style={{
                          paddingLeft: currentFilePath.length + 0.5 + "rem",
                        }}
                      >
                        {components
                          .filter(
                            (c) => c.info.kind === "story" || c.info.exported
                          )
                          .map((c) => (
                            <button
                              key={c.name}
                              className={clsx(
                                "rounded-full py-1 px-4",
                                c.info.kind === "component"
                                  ? "bg-blue-300 text-blue-900 hover:bg-blue-500 hover:text-white"
                                  : "bg-pink-300 text-pink-900 hover:bg-pink-500 hover:text-white"
                              )}
                              onClick={() =>
                                state.setComponent(`${filePath}:${c.name}`)
                              }
                            >
                              {c.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                }
              );
            })()
          ) : (
            <div className="self-center flex-grow flex flex-col justify-center">
              <FontAwesomeIcon
                icon={faSpinner}
                className="text-6xl animate-spin text-gray-800"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col flex-grow h-screen overflow-hidden bg-white">
          <ActionLogs state={state.actionLogs} />
          <Header>
            <Header.Row>
              {headerAddon}
              {state.component?.componentId && (
                <>
                  <FilePath
                    key="file"
                    filePath={
                      decodeComponentId(state.component.componentId)
                        .currentFilePath
                    }
                  />
                  <Link
                    href={document.location.href}
                    target="_blank"
                    title="Open in new tab"
                    className="text-gray-500 hover:text-gray-200 ml-2 text-lg"
                  >
                    <FontAwesomeIcon icon={faExternalLink} fixedWidth />
                  </Link>
                </>
              )}
              <div className="flex-grow"></div>
              <SmallLogo
                href="https://previewjs.com/docs"
                label={appLabel}
                title={state.appInfo?.version && `v${state.appInfo.version}`}
              />
              <Link
                className="ml-2 text-xl text-[#1DA1F2] hover:text-white"
                href="https://twitter.com/previewjs"
                target="_blank"
                title="Follow Preview.js on Twitter"
              >
                <FontAwesomeIcon icon={faTwitter} fixedWidth />
              </Link>
              <Link
                className="ml-2 text-xl bg-[#333] text-white rounded-md hover:bg-white hover:text-[#333]"
                href="https://github.com/fwouts/previewjs"
                target="_blank"
                title="Star Preview.js on GitHub"
              >
                <FontAwesomeIcon icon={faGithub} fixedWidth />
              </Link>
            </Header.Row>
            {subheader && (
              <Header.Row className="bg-gray-100">{subheader}</Header.Row>
            )}
          </Header>
          <UpdateBanner state={state.updateBanner} />
          {state.component ? (
            viewport
          ) : (
            <div
              id="no-selection"
              className="flex-grow bg-gray-700 text-gray-100 p-2 grid place-items-center text-lg"
            >
              Please select a component to preview.
            </div>
          )}
          <TabbedPanel defaultTabKey="props" tabs={tabs} height={panelHeight} />
          {footer}
        </div>
      </div>
    );
  }
);

type PropsPanelProps = {
  componentName: string;
  propsType: ValueType;
  types: CollectedTypes;
  source: string;
  onChange: (source: string) => void;
  onReset?: () => void;
  codeEditor: React.ReactNode;
};

const DefaultPropsPanel: React.FunctionComponent<PropsPanelProps> = ({
  codeEditor,
  onReset,
}) => {
  return (
    <Fragment>
      <button
        id="editor-refresh-button"
        className={clsx([
          "absolute right-0 m-2 p-2 bg-gray-500 rounded-md z-50",
          onReset
            ? "bg-opacity-40 text-white cursor-pointer hover:bg-gray-400"
            : "bg-opacity-25 text-gray-500",
        ])}
        title="Reset properties"
        disabled={!onReset}
        onClick={onReset}
      >
        <FontAwesomeIcon icon={faCircleXmark} />
      </button>
      {codeEditor}
    </Fragment>
  );
};
