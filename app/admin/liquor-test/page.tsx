"use client";

import { useState } from "react";

export default function LiquorTest() {
  const [searchText, setSearchText] = useState("Smith");
  const [results, setResults] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function search() {
    setMessage("");
    setResults([]);

    try {
      const res = await fetch(
        `/api/liquor/browse?searchText=${encodeURIComponent(searchText.trim())}`
      );

      const json = await res.json();
      if (!json.ok) {
        setMessage(`Search failed: ${json.error ?? "Unknown error"}`);
        return;
      }

      // Your /api/liquor/browse returns { ok:true, data:[...] } OR { ok:true, results:[...] }
      const arr = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.results)
        ? json.results
        : [];

      setResults(arr);
      setMessage(`Search OK. Results: ${arr.length}`);
    } catch (e: any) {
      setMessage(`Search crashed: ${e?.message ?? "Unknown error"}`);
    }
  }

  async function save() {
    setMessage("");

    if (!Array.isArray(results) || results.length === 0) {
      setMessage("Nothing to save. Click 'Search NSW' first.");
      return;
    }

    try {
      const res = await fetch("/api/liquor/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: results }),
      });

      const json = await res.json();
      if (!json.ok) {
        setMessage(`Save failed: ${json.error ?? "Unknown error"}`);
        return;
      }

      setMessage(`Saved ${json.upserted} venues to DB.`);
    } catch (e: any) {
      setMessage(`Save crashed: ${e?.message ?? "Unknown error"}`);
    }
  }

  async function loadDb() {
    setMessage("");
    setResults([]);

    try {
      const res = await fetch("/api/venues?limit=20");
      const json = await res.json();

      if (!json.ok) {
        setMessage(`Load DB failed: ${json.error ?? "Unknown error"}`);
        return;
      }

      const arr = Array.isArray(json.data) ? json.data : [];
      setResults(arr);
      setMessage(`Load DB OK. Rows: ${arr.length}`);
    } catch (e: any) {
      setMessage(`Load DB crashed: ${e?.message ?? "Unknown error"}`);
    }
  }

  return (
    <main style={{ padding: 30, fontFamily: "system-ui" }}>
      <h1>Liquor Register Test</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ padding: 10, minWidth: 240 }}
        />
        <button onClick={search} style={{ padding: "10px 14px" }}>
          Search NSW
        </button>
        <button onClick={save} style={{ padding: "10px 14px" }}>
          Save to DB
        </button>
        <button onClick={loadDb} style={{ padding: "10px 14px" }}>
          Load from DB
        </button>
      </div>

      {message && (
        <div style={{ marginBottom: 12, padding: 10, background: "#f5f5f5", borderRadius: 8 }}>
          {message}
        </div>
      )}

      <pre style={{ maxHeight: 450, overflow: "auto", background: "#111", color: "#eee", padding: 12, borderRadius: 8 }}>
        {JSON.stringify((Array.isArray(results) ? results : []).slice(0, 10), null, 2)}
      </pre>
    </main>
  );
}
