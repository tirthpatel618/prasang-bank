"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Prasang = {
  id: number;
  prasang: string;
  notes: string | null;
  topics: string[] | null;
  event_date: string | null;
  created_at: string;
};

type TopicChip = { value: string; label: string }; 

const norm = (s: string) => s.trim().toLowerCase();

function prettyTopic(raw: string) {
  // preserve hyphens, title-case words
  return raw
    .split("-")
    .map(part =>
      part
        .split(/\s+/)
        .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(" ")
    )
    .join("-");
}

function uniqueTopicsCaseInsensitive(rows: { topic: string }[]): TopicChip[] {
  const map = new Map<string, string>(); // value -> label
  for (const r of rows) {
    const v = norm(r.topic);
    if (!map.has(v)) map.set(v, prettyTopic(r.topic));
  }
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function escapeLike(s: string) {
  return s.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export default function Page() {
  const [rawPrasangs, setRawPrasangs] = useState<Prasang[]>([]);
  const [allTopics, setAllTopics] = useState<TopicChip[]>([]);
  const [selected, setSelected] = useState<string[]>([]); // normalized values
  const [matchAll, setMatchAll] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Load topics from view (case-insensitive merge)
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("v_topics").select("topic");
      if (!alive) return;
      if (error) setErr(error.message);
      else setAllTopics(uniqueTopicsCaseInsensitive((data || []) as { topic: string }[]));
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load prasangs (keep this simple; search is server-side, topic filter is client-side)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        let query = supabase
          .from("prasangs")
          .select("id, prasang, notes, topics, event_date, created_at")
          .order("created_at", { ascending: false })
          .limit(500); // tweak as needed

        if (q.trim()) {
          const like = escapeLike(q.trim());
          query = query.or(`prasang.ilike.%${like}%,notes.ilike.%${like}%`);
        }

        const { data, error } = await query;
        if (!alive) return;
        if (error) setErr(error.message);
        else setRawPrasangs((data || []) as Prasang[]);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Unknown error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  // Case-insensitive topic filtering on the client
  const prasangs = useMemo(() => {
    if (selected.length === 0) return rawPrasangs;
    const want = new Set(selected.map(norm));
    return rawPrasangs.filter(p => {
      const pts = (p.topics || []).map(norm);
      if (pts.length === 0) return false;
      return matchAll
        ? Array.from(want).every(t => pts.includes(t))
        : Array.from(want).some(t => pts.includes(t));
    });
  }, [rawPrasangs, selected, matchAll]);

  const filteredCount = prasangs.length;

  // Copy handler
  async function copyPrasang(p: Prasang) {
    try {
      await navigator.clipboard.writeText(p.prasang);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // fallback
      window.prompt("Copy prasang:", p.prasang);
    }
  }

  return (
    <main className="wrap">
      <header className="header">
        <div>
          <h1 className="title">Prasang Bank</h1>
          <p className="muted">Browse and filter by topics</p>
        </div>
        <div className="toolbar">
          <input
            className="input"
            placeholder="Search prasang or notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={matchAll}
              onChange={(e) => setMatchAll(e.target.checked)}
            />
            <span>Match all topics</span>
          </label>
        </div>
      </header>

      {/* Topic chips (case-insensitive, merged) */}
      <section className="chips">
        {allTopics.map((t) => {
          const active = selected.includes(t.value);
          return (
            <button
              key={t.value}
              className={active ? "chip chip--active" : "chip"}
              onClick={() =>
                setSelected(active ? selected.filter((x) => x !== t.value) : [...selected, t.value])
              }
              aria-pressed={active}
              title={active ? "Click to remove" : "Click to filter"}
            >
              {t.label}
            </button>
          );
        })}
        {allTopics.length === 0 && (
          <span className="muted small">No topics yet — add some via the bot.</span>
        )}
      </section>

      {/* Status */}
      <div className="status">
        <span>{loading ? "Loading…" : `${filteredCount} result${filteredCount === 1 ? "" : "s"}`}</span>
        {selected.length > 0 && (
          <button className="link" onClick={() => setSelected([])}>
            Clear topics
          </button>
        )}
      </div>

      {/* Grid */}
      <section className="grid">
        {prasangs.map((p) => {
          // merge/pretty topics per row for display
          const merged = Array.from(new Set((p.topics || []).map(norm))).map(prettyTopic);
          return (
            <article key={p.id} className="card">
              <div className="card-tags">
                {merged.length > 0 ? (
                  merged.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="muted small">No topics</span>
                )}
              </div>

              <p
                className={`prasang copyable${copiedId === p.id ? " copied" : ""}`}
                onClick={() => copyPrasang(p)}
                title="Click to copy"
              >
                {p.prasang}
              </p>
              {copiedId === p.id && <div className="copied-badge">Copied!</div>}

              {p.notes && <p className="notes">{p.notes}</p>}

              <footer className="card-footer">
                <span>
                  {p.event_date ? new Date(p.event_date + "T00:00:00").toLocaleDateString() : ""}
                </span>
                <span>
                  {new Date(p.created_at).toLocaleDateString()} •{" "}
                  {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </footer>
            </article>
          );
        })}
      </section>

      {!loading && prasangs.length === 0 && (
        <div className="empty">No prasangs match your filters.</div>
      )}

      {err && <div className="error">{err}</div>}
    </main>
  );
}
