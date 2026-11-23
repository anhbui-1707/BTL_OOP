import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/premium.css";
import Workspace from "./features/workspace/Workspace";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname === "/preview-v2" ? <Workspace /> : <App />}
  </React.StrictMode>,
);
