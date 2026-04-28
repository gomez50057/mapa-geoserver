"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  ALLOWED_SEARCH_REGION_LABEL,
  SEARCH_LIMITS,
} from "@/lib/search/searchBounds";
import {
  buildCoordinateSearchResult,
  parseCoordinateQuery,
} from "@/lib/search/geocoder";

function bboxToLeafletBounds(bbox) {
  if (!bbox) return null;
  const values = [bbox.lon1, bbox.lat1, bbox.lon2, bbox.lat2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;

  const west = Math.min(values[0], values[2]);
  const east = Math.max(values[0], values[2]);
  const south = Math.min(values[1], values[3]);
  const north = Math.max(values[1], values[3]);

  return L.latLngBounds([south, west], [north, east]);
}

export function useMapSearch({ mapRef }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const debounceTimerRef = useRef(null);
  const requestAbortRef = useRef(null);
  const cacheRef = useRef(new Map());
  const markerLayerRef = useRef(null);

  const clearSearchMarker = useCallback(() => {
    markerLayerRef.current?.remove?.();
    markerLayerRef.current = null;
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setExpanded(false);
    setHighlightedIndex(-1);
  }, []);

  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    requestAbortRef.current?.abort?.();
    requestAbortRef.current = null;
    setQuery("");
    setResults([]);
    setLoading(false);
    setMessage("");
    setOpen(false);
    setExpanded(false);
    setHighlightedIndex(-1);
  }, []);

  const focusResult = useCallback(
    (result) => {
      const map = mapRef.current;
      if (!map || !result) return;

      clearSearchMarker();

      const latlng = L.latLng(result.lat, result.lon);
      const marker = L.circleMarker(latlng, {
        radius: 8,
        color: "#ffffff",
        weight: 2.4,
        fillColor: "#7a1d31",
        fillOpacity: 1,
      }).bindPopup(
        `
          <div style="font-family:Montserrat,sans-serif;display:grid;gap:4px;line-height:1.3;min-width:180px;">
            <strong style="font-size:12.5px;color:#202020;">${result.label}</strong>
            ${result.secondaryLabel ? `<span style="font-size:11.5px;color:#666;">${result.secondaryLabel}</span>` : ""}
          </div>
        `,
        {
          closeButton: false,
          offset: [0, -10],
          autoPanPadding: [24, 24],
        }
      );

      markerLayerRef.current = L.layerGroup([marker]).addTo(map);

      const bounds = bboxToLeafletBounds(result.bbox);
      if (bounds?.isValid?.()) {
        map.fitBounds(bounds, {
          padding: [48, 48],
          animate: true,
        });
      } else {
        map.flyTo(latlng, Math.max(map.getZoom(), 15), {
          duration: 0.85,
          easeLinearity: 0.22,
        });
      }

      window.setTimeout(() => {
        marker.openPopup();
      }, 220);
    },
    [clearSearchMarker, mapRef]
  );

  const selectResult = useCallback(
    (result) => {
      focusResult(result);
      setQuery(result.label);
      setOpen(false);
      setExpanded(false);
      setHighlightedIndex(-1);
    },
    [focusResult]
  );

  const selectedResult = useMemo(
    () => (highlightedIndex >= 0 ? results[highlightedIndex] : null),
    [highlightedIndex, results]
  );

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    requestAbortRef.current?.abort?.();
    requestAbortRef.current = null;

    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      setMessage("");
      setOpen(false);
      setExpanded(false);
      setHighlightedIndex(-1);
      return undefined;
    }

    const coordinateMatch = parseCoordinateQuery(trimmedQuery);
    if (coordinateMatch) {
      const coordinateResult = buildCoordinateSearchResult(coordinateMatch);
      setLoading(false);
      setResults(coordinateResult.valid && coordinateResult.result ? [coordinateResult.result] : []);
      setMessage(coordinateResult.message || "");
      setOpen(true);
      setHighlightedIndex(coordinateResult.valid ? 0 : -1);
      return undefined;
    }

    if (trimmedQuery.length < SEARCH_LIMITS.minQueryLength) {
      setResults([]);
      setLoading(false);
      setMessage(`La búsqueda está limitada a ${ALLOWED_SEARCH_REGION_LABEL}.`);
      setOpen(true);
      setHighlightedIndex(-1);
      return undefined;
    }

    const cacheKey = trimmedQuery.toLowerCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setResults(cached.results);
      setMessage(cached.message || "");
      setLoading(false);
      setOpen(true);
      setHighlightedIndex(cached.results.length ? 0 : -1);
      return undefined;
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      requestAbortRef.current = controller;
      setLoading(true);
      setOpen(true);
      setMessage("");

      try {
        const response = await fetch(
          `/api/search/geocode?q=${encodeURIComponent(trimmedQuery)}&limit=${SEARCH_LIMITS.maxSuggestions}`,
          { signal: controller.signal }
        );
        const payload = await response.json();
        if (controller.signal.aborted) return;

        const nextResults = Array.isArray(payload.results) ? payload.results : [];
        const nextMessage =
          payload.message || (nextResults.length === 0 ? `La búsqueda está limitada a ${ALLOWED_SEARCH_REGION_LABEL}.` : "");

        cacheRef.current.set(cacheKey, {
          results: nextResults,
          message: nextMessage,
          expiresAt: Date.now() + SEARCH_LIMITS.cacheTtlMs,
        });

        setResults(nextResults);
        setMessage(nextMessage);
        setHighlightedIndex(nextResults.length ? 0 : -1);
      } catch (error) {
        if (error?.name === "AbortError") return;
        setResults([]);
        setHighlightedIndex(-1);
        setMessage("No fue posible completar la búsqueda en este momento.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          requestAbortRef.current = null;
        }
      }
    }, SEARCH_LIMITS.debounceMs);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    requestAbortRef.current?.abort?.();
    clearSearchMarker();
  }, [clearSearchMarker]);

  return {
    query,
    setQuery,
    results,
    loading,
    message,
    open,
    setOpen,
    expanded,
    setExpanded,
    highlightedIndex,
    setHighlightedIndex,
    selectedResult,
    selectResult,
    clearSearch,
    closeSearch,
    clearSearchMarker,
  };
}
