"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link className="brand" href="/">KIOREL</Link>
        <span className="mono auth-label">SECURE ACCESS</span>
        <h1>Sign in</h1>
        <p>Access your KIOREL workspace and event infrastructure.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          <button className="button primary" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        {message && <p className="auth-message">{message}</p>}
        <p className="auth-footer">New to KIOREL? <Link href="/signup">Create an account</Link></p>
      </div>
    </main>
  );
}
