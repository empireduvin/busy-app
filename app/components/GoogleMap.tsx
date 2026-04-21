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
  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps="true"]'
    );

    if (existing) {
      const handleLoad = () => resolve();
      const handleError = () => {
        googleMapsScriptPromise = null;
        reject(new Error("Google Maps script failed to load"));
      };

      existing.addEventListener("load", handleLoad, { once: true });
      existing.addEventListener("error", handleError, { once: true });
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
    script.onerror = () => {
      googleMapsScriptPromise = null;
      reject(new Error("Google Maps script failed to load"));
    };

    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

export default function GoogleMap({ venues }: { venues: MapVenue[] }) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);

  const [status, setStatus] = useState<string>("Loading map...");
  const [mapReady, setMapReady] = useState(false);

  function refreshMapLayout() {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    window.google.maps.event.trigger(map, "resize");
  }

  useEffect(() => {
    if (window.google?.maps) {
      setStatus("");
      setMapReady(true);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

    if (!apiKey) {
      setStatus("Map unavailable right now.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setStatus("Loading Google Maps...");
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
            zoomControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false,
            gestureHandling: "greedy",
          });

          infoRef.current = new window.google.maps.InfoWindow();
        }

        setStatus("");
        setMapReady(true);
      } catch (e) {
        console.error(e);
        setStatus("Map unavailable right now.");
        setMapReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps || !mapReady) return;

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
  }, [mapReady, venues]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    const handleResize = () => {
      refreshMapLayout();
    };

    window.addEventListener("resize", handleResize);

    const timeout = window.setTimeout(handleResize, 200);

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && mapDivRef.current
        ? new ResizeObserver(() => {
            handleResize();
          })
        : null;

    if (resizeObserver && mapDivRef.current) {
      resizeObserver.observe(mapDivRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(timeout);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!mapReady) return;

    const first = window.setTimeout(() => refreshMapLayout(), 80);
    const second = window.setTimeout(() => refreshMapLayout(), 260);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [mapReady, venues.length]);

  return (
    <div className="grid gap-3">
      {status ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
          {status}
        </div>
      ) : null}

      <div
        ref={mapDivRef}
        className="h-[min(62vh,560px)] min-h-[300px] w-full overflow-hidden rounded-2xl border border-white/10 sm:h-[min(70vh,720px)] sm:min-h-[420px]"
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
