const Template = (args) => <div id="ready">preact: {args.text}</div>;

export const App = Template.bind({});

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
      <div style={{ padding: "8px" }}>
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
