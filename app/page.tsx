const capabilities = [
  ["KIOREL Signal", "First-party event collection from websites and applications."],
  ["KIOREL Flow", "Reliable routing to the marketing platforms you already use."],
  ["KIOREL Trace", "See where every event came from, what changed, and where it went."],
  ["KIOREL Pulse", "Detect missing, delayed, duplicated, or rejected tracking events."],
  ["KIOREL Guard", "Consent, data minimization, retention, and governance controls."],
  ["KIOREL AI", "Explain tracking failures and suggest practical fixes."]
];

export default function Home() {
  return (
    <main className="shell">
      <header className="nav">
        <a className="brand" href="/">KIOREL</a>
        <nav>
          <a href="#product">Product</a>
          <a href="#architecture">Architecture</a>
          <a href="#early-access">Early access</a>
        </nav>
        <a className="button secondary" href="#early-access">Get started</a>
      </header>

      <section className="hero">
        <div className="eyebrow"><span /> First-party marketing data infrastructure</div>
        <h1>Marketing data you can <em>actually trust.</em></h1>
        <p className="lead">
          KIOREL collects, validates, deduplicates, routes, and explains your conversion events —
          before unreliable tracking becomes unreliable decisions.
        </p>
        <div className="actions">
          <a className="button primary" href="#early-access">Build with KIOREL →</a>
          <a className="button secondary" href="#architecture">View architecture</a>
        </div>
      </section>

      <section id="product" className="section">
        <div className="section-heading">
          <span className="mono">CORE PLATFORM</span>
          <h2>One event pipeline. Full visibility.</h2>
        </div>
        <div className="grid">
          {capabilities.map(([name, description]) => (
            <article className="card" key={name}>
              <span className="card-index">KIOREL / {name.split(" ")[1]}</span>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="architecture" className="section architecture">
        <div className="section-heading">
          <span className="mono">EVENT PIPELINE</span>
          <h2>Normalize once. Route everywhere.</h2>
        </div>
        <div className="pipeline">
          {["Website / WordPress", "KIOREL Gateway", "Validate · Consent · Dedupe", "Queue + Retry", "Meta · GA4 · Other destinations"].map((step, i) => (
            <div className="pipeline-step" key={step}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section id="early-access" className="section cta">
        <span className="mono">PRIVATE BETA</span>
        <h2>KIOREL is being built for real production data.</h2>
        <p>The first production test environment will validate the platform against a real website before wider release.</p>
        <a className="button primary" href="mailto:hello@kiorel.com">Request access →</a>
      </section>

      <footer>© 2026 KIOREL. First-party data infrastructure.</footer>
    </main>
  );
}