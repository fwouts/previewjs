import type { AppProps } from "next/app";
import "../styles/globals.css";

const A = ({ Foo }: { Foo: React.ComponentType }) => {
  return (
    <div>
      <Foo />
    </div>
  );
};

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
export default MyApp;
