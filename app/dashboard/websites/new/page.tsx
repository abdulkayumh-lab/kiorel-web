"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewWebsitePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/websites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, domain }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not add website.");
      setLoading(false);
      return;
    }

    setApiKey(data.api_key);
    setLoading(false);
  }

  if (apiKey) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <span className="mono auth-label">INGESTION KEY CREATED</span>
          <h1>Save this key.</h1>
          <p>KIOREL will not display the full secret again. Store it securely before continuing.</p>
          <div className="key-box">{apiKey}</div>
          <button className="button primary" onClick={() => router.push("/dashboard")}>Continue to dashboard</button>
          <p className="auth-message">Treat this key like a credential. Never publish it in browser-visible source code or commit it to Git.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link className="brand" href="/dashboard">KIOREL</Link>
        <span className="mono auth-label">ADD WEBSITE</span>
        <h1>Connect a site</h1>
        <p>Register the first website you want KIOREL to collect events from.</p>
        <form onSubmit={submit} className="auth-form">
          <label>Website name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Birds Aviary" /></label>
          <label>Domain<input required value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="birdsaviary.net" /></label>
          <button className="button primary" disabled={loading}>{loading ? "Creating…" : "Create website + key"}</button>
        </form>
        {message && <p className="auth-message">{message}</p>}
        <p className="auth-footer"><Link href="/dashboard">← Back to dashboard</Link></p>
      </div>
    </main>
  );
}
