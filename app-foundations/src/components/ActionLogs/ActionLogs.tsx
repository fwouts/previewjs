import { observer } from "mobx-react-lite";
import React from "react";
import { Link } from "../../design/Link";
import { PopOver } from "../../design/PopOver";
import type { ActionLogsState } from "./ActionLogsState";

export const ActionLogs = observer(({ state }: { state: ActionLogsState }) => {
  return (
    <PopOver.Container>
      {state.logs.map((item) => (
        <PopOver.Item key={item.key} onAnimationComplete={item.remove}>
          {item.action.type === "fn" ? (
            <>
              Function prop invoked: <b>{item.action.path}</b>
            </>
          ) : (
            <>
              Redirect prevented:{" "}
              <Link href={item.action.path}>{item.action.path}</Link>
            </>
          )}
          {item.count > 1 && ` (x${item.count})`}
        </PopOver.Item>
      ))}
    </PopOver.Container>
  );
});
