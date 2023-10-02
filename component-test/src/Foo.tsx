import { isEqual } from "lodash";
import { Bold } from "./Bold";

export const Foo = () => {
  return (
    <div>
      Hello: <Bold>{isEqual(1, 2)}</Bold>!
    </div>
  );
};
