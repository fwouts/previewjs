import { StoryObj } from "@storybook/preact";
import { Button } from "./Button";

// More on how to set up stories at: https://storybook.js.org/docs/preact/writing-stories/introduction
export default {
  title: "Example/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    backgroundColor: { control: "color" },
    onClick: { action: "onClick" },
  },
};

// More on writing stories with args: https://storybook.js.org/docs/preact/writing-stories/args
export const Primary: StoryObj = {
  args: {
    primary: true,
    label: "Button",
  },
};

export const Secondary: StoryObj = {
  args: {
    label: "Button",
  },
};

export const Large: StoryObj = {
  args: {
    size: "large",
    label: "Button",
  },
};

export const Small: StoryObj = {
  args: {
    size: "small",
    label: "Button",
  },
};
