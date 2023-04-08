import Paper from "@material-ui/core/Paper";
import { TextField } from "@material-ui/core";
import PersonIcon from "@mui/icons-material/Person";
import React from "react";

function App() {
  return (
    <div id="ready">
      <Paper style={{ padding: "8px" }}>
        <PersonIcon />
        <TextField value="foo" />
      </Paper>
    </div>
  );
}

export default App;
