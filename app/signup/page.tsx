"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: origin + "/auth/callback" },
    });

    if (error) {
      setMessage(error.message);
    } else if (data.session) {
      window.location.href = "/dashboard";
      return;
    } else {
      setMessage("Check your email to confirm your KIOREL account.");
    }

    setLoading(false);
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link className="brand" href="/">KIOREL</Link>
        <span className="mono auth-label">PRIVATE BETA</span>
        <h1>Create account</h1>
        <p>Start with one workspace. We will add your first website next.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
          <button className="button primary" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
        </form>
        {message && <p className="auth-message">{message}</p>}
        <p className="auth-footer">Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </main>
  );
}
