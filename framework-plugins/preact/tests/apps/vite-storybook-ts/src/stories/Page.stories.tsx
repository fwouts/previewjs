import { StoryObj } from "@storybook/preact";
import { userEvent, within } from "@storybook/testing-library";

import { Page } from "./Page";

export default {
  title: "Example/Page",
  component: Page,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/preact/configure/story-layout
    layout: "fullscreen",
  },
};

export const LoggedOut: StoryObj = {};

// More on interaction testing: https://storybook.js.org/docs/preact/writing-tests/interaction-testing
export const LoggedIn: StoryObj = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loginButton = await canvas.getByRole("button", {
      name: /Log in/i,
    });
    await userEvent.click(loginButton);
  },
};
