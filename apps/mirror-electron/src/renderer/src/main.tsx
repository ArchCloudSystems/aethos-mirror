import React from "react";
import ReactDOM from "react-dom/client";
import { MirrorRenderer } from "./app";
import "./global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MirrorRenderer />
  </React.StrictMode>
);
