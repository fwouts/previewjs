import { withKnobs } from "@storybook/addon-knobs";

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};

const withBox = (Story) => (
  <div style={{ padding: "16px", background: "#00f" }}>
    <Story />
  </div>
);

export const decorators = [withKnobs, withBox];
