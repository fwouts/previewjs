import React from "react";
import { Page } from "./Page";

const Template = (args) => (
  <div id="ready">
    <Page {...args} />
  </div>
);

export const App = Template.bind({});
App.propTypes = Page.propTypes;

App.decorators = [
  (Story) => (
    <div style={{ background: "#f82" }}>
      <Story />
    </div>
  ),
  (Story) => (
    <div style={{ border: "2px solid #00f" }}>
      <Story />
    </div>
  ),
];

export default {
  title: "Example/App",
  component: App,
  decorators: [
    (Story) => (
      <div style={{ padding: "3em" }}>
        <Story />
      </div>
    ),
    (Story) => (
      <div style={{ border: "2px solid #f00" }}>
        <Story />
      </div>
    ),
  ],
};
