import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

function App(): JSX.Element {
  return (
    <main className="mirror-shell">
      <section className="mirror-card">
        <p className="eyebrow">AetherCore Display Node</p>
        <h1>Aethos Mirror</h1>

        <div className="status-grid">
          <div>
            <span>CAILEAN</span>
            <strong>standby</strong>
          </div>
          <div>
            <span>EILIDH / Ailee</span>
            <strong>standby</strong>
          </div>
          <div>
            <span>Current mode</span>
            <strong>landing</strong>
          </div>
          <div>
            <span>API</span>
            <strong>http://127.0.0.1:3055</strong>
          </div>
        </div>

        <p className="note">
          Aethos Mirror is the display, browser, and overlay appliance. AetherCore remains the brain.
        </p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
