import styled from "@emotion/styled";
import { faGithub, faTwitter } from "@fortawesome/free-brands-svg-icons";
import {
  faAngleDown,
  faAngleUp,
  faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
    <Container>
      <TabsContainer>
        {tabs.length > 0 && (
          <ToggleButton onClick={() => setVisible(!visible)}>
            <FontAwesomeIcon icon={visible ? faAngleDown : faAngleUp} />
          </ToggleButton>
        )}
        {tabs.map((tab) => (
          <Tab
            selected={visible && tab.key === currentTabKey}
            key={tab.key}
            onClick={() => {
              setVisible(true);
              setCurrentTabKey(tab.key);
            }}
            className="panel-tab"
          >
            {tab.label}
            {tab.notificationCount > 0 && (
              <TabNotificationBubble>
                {tab.notificationCount}
              </TabNotificationBubble>
            )}
          </Tab>
        ))}
        <Spacer />
        <OpenBrowser
          href={document.location.href}
          target="_blank"
          title="Open in browser"
        >
          <FontAwesomeIcon
            icon={faExternalLinkAlt}
            color="hsl(213, 80%, 50%)"
            size="lg"
          />
        </OpenBrowser>
        <OpenBrowser
          href="https://github.com/fwouts/previewjs"
          target="_blank"
          title="GitHub"
        >
          <FontAwesomeIcon icon={faGithub} color="#333" size="2x" />
        </OpenBrowser>
        <OpenBrowser
          href="https://twitter.com/fwouts"
          target="_blank"
          title="Follow Preview.js's author on Twitter"
        >
          <FontAwesomeIcon icon={faTwitter} color="#1DA1F2" size="2x" />
        </OpenBrowser>
      </TabsContainer>
      {visible && currentTab && (
        <Panel $height={height}>{currentTab && currentTab.panel}</Panel>
      )}
    </Container>
  );
};

const Container = styled.div`
  background: #fff;
  font-size: 12px;
  z-index: 100;
  flex-shrink: 0;
`;

const DefaultTabColor = "#fff";
const SelectedTabColor = "#E5E9EF";

const TabsContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  border-left: 1px solid ${DefaultTabColor};
  border-radius: 8px 8px 0 0;
  margin-bottom: -1px;
`;

const Tab = styled.button<{ selected: boolean }>`
  padding: 8px;
  cursor: pointer;
  border-style: solid;
  border-color: ${DefaultTabColor};
  border-width: 1px 1px 0 0;
  border-radius: 8px 8px 0 0;
  background: ${({ selected }) =>
    selected ? SelectedTabColor : DefaultTabColor};
  outline: none;
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TabNotificationBubble = styled.span`
  margin: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 10px;
  font-size: 12px;
  background: hsl(0, 73%, 50%);
  color: #fff;
`;

const Spacer = styled.span`
  flex-grow: 1;
`;

const OpenBrowser = styled(Link)`
  padding: 8px;
  font-weight: bold;
  text-decoration: none;
  margin-left: 8px;

  &:hover {
    color: hsl(213, 100%, 36%);
  }
`;

const ToggleButton = styled.button`
  border: none;
  outline: none;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  background: #fff;
  font-size: 20px;

  &:hover {
    color: hsl(213, 80%, 40%);
  }
`;

const Panel = styled.div<{ $height: number }>`
  border-top: 1px solid ${SelectedTabColor};
  background: ${SelectedTabColor};
  height: ${({ $height }) => $height}px;
  display: flex;
  flex-direction: column;
`;
