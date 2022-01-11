import styled from "@emotion/styled";
import { motion } from "framer-motion";
import { observer } from "mobx-react-lite";
import React from "react";
import { Link } from "../Link/Link";
import { ActionLogProps } from "./ActionLogProps";
import { ActionLogsState } from "./ActionLogsState";

export const ActionLogs = observer(({ state }: { state: ActionLogsState }) => {
  return (
    <ActionLogsBox>
      {state.logs.map((action) => (
        <ActionLog {...action} key={action.key} />
      ))}
    </ActionLogsBox>
  );
});

const ActionLogsBox = styled.div`
  position: absolute;
  overflow: hidden;
  bottom: 0;
  right: 0;
  z-index: 10;
  overflow: hidden;
`;

const ActionLog = (props: ActionLogProps) => {
  return (
    <motion.div
      animate={{ x: "100%" }}
      transition={{ delay: 3 }}
      onAnimationComplete={props.onAnimationComplete}
    >
      <motion.div
        animate={{ x: 0, marginBottom: 0 }}
        initial={{ x: "100%", marginBottom: -100 }}
        transition={{ type: "tween" }}
      >
        <ActionLogBox className="action-log">
          {props.action.type === "fn" ? (
            <>
              Function prop invoked: <b>{props.action.path}</b>
            </>
          ) : (
            <>
              Redirect prevented:{" "}
              <ColoredLink href={props.action.path}>
                {props.action.path}
              </ColoredLink>
            </>
          )}
          {props.count > 1 && ` (x${props.count})`}
        </ActionLogBox>
      </motion.div>
    </motion.div>
  );
};

const ActionLogBox = styled.div`
  background: #fff;
  border: 2px solid #6998f7;
  border-radius: 8px;
  padding: 8px;
  margin: 8px;
  animation-fill-mode: forwards;
`;

const ColoredLink = styled(Link)`
  color: hsl(213, 100%, 10%);
`;
