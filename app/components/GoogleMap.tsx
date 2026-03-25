"use client";

import { useEffect, useRef, useState } from "react";

type MapVenue = {
  id: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
};

declare global {
  interface Window {
    google?: any;
  }
}

let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps="true"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps script failed"))
      );
      return;
    }

    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly&libraries=places`;

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google Maps script failed to load"));

    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

export default function GoogleMap({ venues }: { venues: MapVenue[] }) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);

  const [status, setStatus] = useState<string>("Loading map…");

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setStatus("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setStatus("Loading Google Maps…");
        await loadGoogleMaps(apiKey);
        if (cancelled) return;

        if (!mapDivRef.current) {
          setStatus("Map container not found");
          return;
        }

        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(mapDivRef.current, {
            center: { lat: -33.883, lng: 151.18 },
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false,
            gestureHandling: "greedy",
          });

          infoRef.current = new window.google.maps.InfoWindow();
        }

        setStatus("");
      } catch (e: any) {
        console.error(e);
        setStatus(e?.message ?? "Failed to load Google Maps");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const withCoords = venues.filter(
      (v) =>
        typeof v.lat === "number" &&
        !Number.isNaN(v.lat) &&
        typeof v.lng === "number" &&
        !Number.isNaN(v.lng)
    );

    if (withCoords.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    withCoords.forEach((v) => {
      const pos = { lat: v.lat!, lng: v.lng! };

      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        title: v.name ?? "Venue",
      });

      marker.addListener("click", () => {
        const el = document.getElementById(`venue-${v.id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });

        if (infoRef.current) {
          infoRef.current.setContent(
            `<div style="font-weight:600;">${escapeHtml(v.name ?? "Venue")}</div>`
          );
          infoRef.current.open({ anchor: marker, map });
        }
      });

      markersRef.current.push(marker);
      bounds.extend(pos);
    });

    map.fitBounds(bounds, 60);

    if (withCoords.length === 1) {
      map.setZoom(15);
      map.setCenter({ lat: withCoords[0].lat!, lng: withCoords[0].lng! });
    }
  }, [venues]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    const handleResize = () => {
      window.google.maps.event.trigger(map, "resize");
    };

    window.addEventListener("resize", handleResize);

    const timeout = window.setTimeout(() => {
      handleResize();
    }, 200);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="grid gap-3">
      {status ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
          {status}
        </div>
      ) : null}

      <div
        ref={mapDivRef}
        className="w-full overflow-hidden rounded-2xl border border-white/10"
        style={{
          height: "min(70vh, 720px)",
          minHeight: 420,
        }}
      />
    </div>
  );
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}