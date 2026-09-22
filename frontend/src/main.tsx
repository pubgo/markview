import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { PresenterTeleprompter } from "./components/PresenterTeleprompter";
import { parsePresenterSearch } from "./utils/slidesPresenterChannel";
import "./styles/app.css";

const presenter = parsePresenterSearch(window.location.search);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {presenter ? <PresenterTeleprompter sessionId={presenter.sessionId} /> : <App />}
  </StrictMode>,
);
