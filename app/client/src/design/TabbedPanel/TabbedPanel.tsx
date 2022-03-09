import {
  faAngleDown,
  faAngleUp,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React, { useState } from "react";
import { Link } from "../Link/Link";

export type PanelTab = {
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
  links: PanelLink[];
}) => {
  const [currentTabKey, setCurrentTabKey] = useState(props.defaultTabKey);
  const [visible, setVisible] = useState(true);
  const currentTab = props.tabs.find((tab) => tab.key === currentTabKey);
  return (
    <div>
      <div className="flex flex-row items-center bg-white shadow-inner">
        {props.tabs.length > 0 && (
          <button
            className="px-4 py-2 hover:text-blue-500"
            onClick={() => setVisible(!visible)}
          >
            <FontAwesomeIcon icon={visible ? faAngleDown : faAngleUp} />
          </button>
        )}
        {props.tabs.map((tab) => (
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
        {props.links.map((link) => (
          <Link
            className="px-3 opacity-60 hover:opacity-100 text-xl"
            key={link.href}
            href={link.href}
            target="_blank"
            title={link.title}
          >
            <FontAwesomeIcon
              icon={link.icon}
              color={link.color}
              className={link.className}
            />
          </Link>
        ))}
      </div>
      {visible && currentTab && (
        <div className="flex flex-col" style={{ height: props.height }}>
          {currentTab.panel}
        </div>
      )}
    </div>
  );
};
