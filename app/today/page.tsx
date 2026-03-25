"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TodayEvent = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  price_note: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  venues: { name: string; suburb: string } | null;
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function categoryLabel(cat: string) {
  switch (cat) {
    case "happy_hour":
      return "Happy hour";
    case "food_special":
      return "Food special";
    case "lunch_special":
      return "Lunch special";
    case "event":
      return "Event";
    case "sport":
      return "Sport";
    default:
      return cat;
  }
}

export default function TodayPage() {
  const [rows, setRows] = useState<TodayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState("All");

  useEffect(() => {
    async function load() {
      const today = DOW[new Date().getDay()];

      const { data, error } = await supabase
        .from("events")
        .select(
          "id,title,category,description,price_note,day_of_week,start_time,end_time,venues(name,suburb)"
        )
        .eq("day_of_week", today)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Supabase events error:", error);
      } else if (data) {
        setRows(data as TodayEvent[]);
      }
      setLoading(false);
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    if (category === "All") return rows;
    return rows.filter((r) => r.category === category);
  }, [rows, category]);

  return (
    <main className="min-h-screen w-full bg-black text-white p-6">
      <h1 className="text-3xl font-bold">Today</h1>
      <p className="text-white/70 mt-2">What’s on in the Inner West</p>

      {/* Filter */}
      <div className="mt-6 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/60">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-black text-white border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
          >
            <option className="bg-black text-white" value="All">
              All
            </option>
            <option className="bg-black text-white" value="happy_hour">
              Happy hour
            </option>
            <option className="bg-black text-white" value="food_special">
              Food special
            </option>
            <option className="bg-black text-white" value="lunch_special">
              Lunch special
            </option>
            <option className="bg-black text-white" value="event">
              Event
            </option>
            <option className="bg-black text-white" value="sport">
              Sport
            </option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="mt-6 text-white/70">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-white/70">
            No events found for today yet. Add a few rows in Supabase →{" "}
            <b>events</b> table (set <b>day_of_week</b> to today’s value like{" "}
            <b>{DOW[new Date().getDay()]}</b>) and refresh.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="rounded-3xl border border-white/10 p-5 bg-white/5 hover:bg-white/10 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-lg">{r.title}</div>
                  <div className="text-sm text-white/60 mt-1">
                    {r.venues ? `${r.venues.name} • ${r.venues.suburb}` : "Venue"}
                  </div>

                  {(r.start_time || r.end_time) ? (
                    <div className="text-sm text-white/60 mt-1">
                      ⏰ {r.start_time ?? ""}{r.end_time ? `–${r.end_time}` : ""}
                    </div>
                  ) : null}

                  {r.price_note ? (
                    <div className="text-sm text-white/80 mt-2">
                      💸 {r.price_note}
                    </div>
                  ) : null}

                  {r.description ? (
                    <div className="text-sm text-white/70 mt-2">
                      {r.description}
                    </div>
                  ) : null}
                </div>

                <span className="text-xs px-3 py-1 rounded-full bg-orange-500 text-black font-medium">
                  {categoryLabel(r.category)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
