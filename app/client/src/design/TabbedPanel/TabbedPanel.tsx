import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React, { useState } from "react";

export type PanelTab = {
  icon: IconDefinition;
  label: string;
  key: string;
  notificationCount: number;
  panel: React.ReactNode;
};

export type PanelLink = {
  icon: IconDefinition;
  title: string;
  href: string;
  color?: string;
  className?: string;
};

export const TabbedPanel = (props: {
  tabs: PanelTab[];
  defaultTabKey: string;
  height: number;
}) => {
  const [currentTabKey, setCurrentTabKey] = useState<string | null>(
    props.defaultTabKey
  );
  const currentTab = props.tabs.find((tab) => tab.key === currentTabKey);
  return (
    <div>
      <div className="flex flex-row flex-wrap items-center bg-white shadow-inner">
        {props.tabs.map((tab) => (
          <button
            key={tab.key}
            title={tab.label}
            onClick={() => {
              setCurrentTabKey(tab.key === currentTabKey ? null : tab.key);
            }}
            className={clsx([
              "panel-tab",
              "px-4 py-3 self-stretch text-sm font-medium flex flex-row items-center",
              tab.key === currentTabKey
                ? "bg-gray-200 text-gray-900"
                : "text-gray-400",
            ])}
          >
            <FontAwesomeIcon icon={tab.icon} />
            <div className={clsx(["ml-2"])}>{tab.label}</div>
            {tab.notificationCount > 0 && (
              <span className="bg-red-600 text-white p-2 rounded-full inline-flex items-center justify-center h-5 min-w-5 ml-1 text-xs">
                {tab.notificationCount}
              </span>
            )}
          </button>
        ))}
      </div>
      {currentTab && (
        <div
          className="flex flex-col bg-gray-200"
          style={{ height: props.height }}
        >
          {currentTab.panel}
        </div>
      )}
    </div>
  );
};
