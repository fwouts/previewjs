import { motion } from "framer-motion";
import { observer } from "mobx-react-lite";
import React from "react";
import { Link } from "../Link/Link";
import { ActionLogProps } from "./ActionLogProps";
import { ActionLogsState } from "./ActionLogsState";

export const ActionLogs = observer(({ state }: { state: ActionLogsState }) => {
  return (
    <div className="absolute overflow-hidden bottom-0 right-0 z-50">
      {state.logs.map((action) => (
        <ActionLog {...action} key={action.key} />
      ))}
    </div>
  );
});

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
        <div className="action-log bg-blue-700 text-blue-100 bg-opacity-40 p-2 m-2 border-2 border-blue-300">
          {props.action.type === "fn" ? (
            <>
              Function prop invoked: <b>{props.action.path}</b>
            </>
          ) : (
            <>
              Redirect prevented:{" "}
              <Link href={props.action.path}>{props.action.path}</Link>
            </>
          )}
          {props.count > 1 && ` (x${props.count})`}
        </div>
      </motion.div>
    </motion.div>
  );
};
