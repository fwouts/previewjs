import { faGithub, faTwitter } from "@fortawesome/free-brands-svg-icons";
import {
  faCode,
  faExternalLink,
  faTerminal,
  faUndo,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { CollectedTypes, ValueType } from "@previewjs/type-analyzer";
import { namedType } from "@previewjs/type-analyzer";
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

    return (
      <div className="flex flex-col h-screen overflow-hidden bg-white">
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
        <TabbedPanel
          defaultTabKey="props"
          tabs={[
            ...((state.component?.variantKey === null ||
              state.component?.variantKey === "custom") &&
            state.component.details
              ? [
                  {
                    label: "Properties",
                    key: "props",
                    icon: faCode,
                    notificationCount: 0,
                    panel: (
                      <PropsPanel
                        componentName={state.component.name}
                        propsType={namedType(
                          state.component.details.props.propsType.propsTypeName
                        )}
                        types={state.component.details.props.propsType.types}
                        source={state.component.details.props.invocationSource}
                        onChange={state.updateProps.bind(state)}
                        onReset={
                          state.component.details.props
                            .isDefaultInvocationSource
                            ? undefined
                            : state.resetProps.bind(state)
                        }
                        codeEditor={
                          <PropsEditor
                            documentId={state.component.componentId}
                            onUpdate={state.updateProps.bind(state)}
                            source={
                              state.component.details.props.invocationSource
                            }
                            typeDeclarationsSource={generatePropsTypeDeclarations(
                              state.component.details.props.propsType
                                .propsTypeName,
                              state.component.details.props.propsType.types
                            )}
                          />
                        }
                      />
                    ),
                  },
                ]
              : []),
            ...(state.component
              ? [
                  {
                    label: "Console",
                    key: "console",
                    icon: faTerminal,
                    notificationCount: state.consoleLogs.unreadCount,
                    panel: <ConsolePanel state={state.consoleLogs} />,
                  },
                ]
              : []),
            ...(panelTabs || []),
          ]}
          height={panelHeight}
        />
        {footer}
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
        <FontAwesomeIcon icon={faUndo} />
      </button>
      {codeEditor}
    </Fragment>
  );
};
