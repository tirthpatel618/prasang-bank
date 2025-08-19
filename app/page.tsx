"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Prasang = {
  id: number;
  prasang: string;
  notes: string | null;
  topics: string[] | null;
  event_date: string | null;
  created_at: string;
};

export default function Page() {
  const [prasangs, setPrasangs] = useState<Prasang[]>([]);
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [matchAll, setMatchAll] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Load topics from view
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("v_topics").select("topic").order("topic");
      if (!alive) return;
      if (error) setErr(error.message);
      else setAllTopics((data || []).map((r: any) => String(r.topic)));
    })();
    return () => { alive = false; };
  }, []);

  // Load prasangs whenever filters change
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        let query = supabase
          .from("prasangs")
          .select("id, prasang, notes, topics, event_date, created_at")
          .order("created_at", { ascending: false });

        if (selected.length > 0) {
          query = matchAll ? query.contains("topics", selected) : query.overlaps("topics", selected);
        }
        if (q.trim()) {
          const like = escapeLike(q.trim());
          query = query.or(`prasang.ilike.%${like}%,notes.ilike.%${like}%`);
        }

        const { data, error } = await query;
        if (!alive) return;
        if (error) setErr(error.message);
        else setPrasangs((data || []) as Prasang[]);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Unknown error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [selected, matchAll, q]);

  return (
    <main className="wrap">
      <header className="header">
        <div>
          <h1 className="title">Prasangs</h1>
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

      <section className="chips">
        {allTopics.map((t) => {
          const active = selected.includes(t);
          return (
            <button
              key={t}
              className={active ? "chip chip--active" : "chip"}
              onClick={() =>
                setSelected(active ? selected.filter((x) => x !== t) : [...selected, t])
              }
              aria-pressed={active}
            >
              {t}
            </button>
          );
        })}
        {allTopics.length === 0 && (
          <span className="muted small">No topics yet — add some via the bot.</span>
        )}
      </section>

      <div className="status">
        <span>{loading ? "Loading…" : `${prasangs.length} result${prasangs.length === 1 ? "" : "s"}`}</span>
        {selected.length > 0 && (
          <button className="link" onClick={() => setSelected([])}>Clear topics</button>
        )}
      </div>

      <section className="grid">
        {prasangs.map((p) => (
          <article key={p.id} className="card">
            <div className="card-tags">
              {(p.topics || []).map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
              {(!p.topics || p.topics.length === 0) && (
                <span className="muted small">No topics</span>
              )}
            </div>

            <p className="prasang">{p.prasang}</p>

            {p.notes && <p className="notes">{p.notes}</p>}

            <footer className="card-footer">
              <span>{p.event_date ? new Date(p.event_date + "T00:00:00").toLocaleDateString() : ""}</span>
              <span>
                {new Date(p.created_at).toLocaleDateString()} •{" "}
                {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </footer>
          </article>
        ))}
      </section>

      {!loading && prasangs.length === 0 && (
        <div className="empty">No prasangs match your filters.</div>
      )}

      {err && <div className="error">{err}</div>}
    </main>
  );
}

function escapeLike(s: string) {
  return s.replaceAll("%", "\\%").replaceAll("_", "\\_");
}
