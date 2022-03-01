const Container: React.FC = ({ children }) => (
  <div className="text-sm bg-gray-900 filter drop-shadow">{children}</div>
);

const Row: React.FC = ({ children }) => (
  <div className="flex flex-row items-center m-2">{children}</div>
);

export const Header = Container as typeof Container & { Row: typeof Row };
Header.Row = Row;
