"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForensicsUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setMessage("Choose an image first.");
    setLoading(true);
    setMessage("");

    const form = new FormData();
    form.set("file", file);

    const response = await fetch("/api/forensics/media", { method: "POST", body: form });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not start analysis.");
      setLoading(false);
      return;
    }

    router.push("/dashboard/forensics/" + data.analysis_id);
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link className="brand" href="/dashboard/forensics">KIOREL</Link>
        <span className="mono auth-label">MEDIA FORENSICS</span>
        <h1>Analyze media</h1>
        <p>Upload an image to create a server-side forensic investigation.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Image
            <input
              required
              type="file"
              accept="image/jpeg,image/png,image/webp,image/tiff"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className="button primary" disabled={loading}>
            {loading ? "Creating analysis…" : "Start analysis"}
          </button>
        </form>
        {message && <p className="auth-message">{message}</p>}
        <p className="auth-footer"><Link href="/dashboard/forensics">← Back to forensics</Link></p>
      </div>
    </main>
  );
}
