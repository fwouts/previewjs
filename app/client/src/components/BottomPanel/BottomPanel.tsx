import { faGithub, faTwitter } from "@fortawesome/free-brands-svg-icons";
import {
  faAngleDown,
  faAngleUp,
  faWindowMaximize,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React, { useState } from "react";
import { Link } from "../Link/Link";

interface PanelTab {
  label: string;
  key: string;
  notificationCount: number;
  panel: React.ReactNode;
}

export const BottomPanel = ({
  tabs,
  height,
}: {
  tabs: PanelTab[];
  height: number;
}) => {
  const [currentTabKey, setCurrentTabKey] = useState("props");
  const [visible, setVisible] = useState(true);
  const currentTab = tabs.find((tab) => tab.key === currentTabKey);
  return (
    <div>
      <div className="flex flex-row items-center bg-white shadow-inner">
        {tabs.length > 0 && (
          <button
            className="px-4 py-2 hover:text-blue-500"
            onClick={() => setVisible(!visible)}
          >
            <FontAwesomeIcon icon={visible ? faAngleDown : faAngleUp} />
          </button>
        )}
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setVisible(true);
              setCurrentTabKey(tab.key);
            }}
            className={clsx([
              "panel-tab",
              "px-4 self-stretch text-sm font-medium",
              visible && tab.key === currentTabKey
                ? "bg-gray-200 text-gray-900"
                : "text-gray-400",
            ])}
          >
            {tab.label}
            {tab.notificationCount > 0 && (
              <span className="bg-red-600 text-white p-2 rounded-full inline-flex items-center justify-center h-5 min-w-5 ml-1 text-xs">
                {tab.notificationCount}
              </span>
            )}
          </button>
        ))}
        <span className="flex-grow" />
        <IconLink
          href={document.location.href}
          target="_blank"
          title="Open in browser"
        >
          <FontAwesomeIcon icon={faWindowMaximize} />
        </IconLink>
        <IconLink
          href="https://github.com/fwouts/previewjs"
          target="_blank"
          title="GitHub"
        >
          <FontAwesomeIcon icon={faGithub} color="#333" />
        </IconLink>
        <IconLink
          href="https://twitter.com/fwouts"
          target="_blank"
          title="Follow Preview.js's author on Twitter"
        >
          <FontAwesomeIcon icon={faTwitter} color="#1DA1F2" />
        </IconLink>
      </div>
      {visible && currentTab && (
        <div className="flex flex-col" style={{ height }}>
          {currentTab.panel}
        </div>
      )}
    </div>
  );
};

const IconLink = (props: React.ComponentProps<typeof Link>) => (
  <Link className="px-3 opacity-60 hover:opacity-100 text-xl" {...props} />
);
