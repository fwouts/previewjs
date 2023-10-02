import { isEqual } from "lodash";
import { Bold } from "./Bold";

export const Foo = () => {
  console.error("FOO", isEqual(1, 2));
  return (
    <div>
      Hello from <Bold>test</Bold>!
    </div>
  );
};
