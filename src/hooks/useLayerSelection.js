"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildLayerIndex, flattenLayers } from "@/data/layerCatalog";

export function useLayerSelection(tree) {
  const layerIndex = useMemo(() => buildLayerIndex(tree), [tree]);
  const allLayers = useMemo(() => flattenLayers(tree), [tree]);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [zOverrides, setZOverrides] = useState(() => new Map());
  const [opacityOverrides, setOpacityOverrides] = useState(() => new Map());

  const buildDefaultSelectionState = useCallback(() => {
    const defaults = allLayers.filter((layer) => layer.defaultVisible);
    const defaultIds = new Set(defaults.map((layer) => layer.id));
    return { defaultIds };
  }, [allLayers]);

  useEffect(() => {
    const { defaultIds } = buildDefaultSelectionState();
    setSelectedIds(defaultIds);
  }, [buildDefaultSelectionState]);

  const onToggleLayer = (layer) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(layer.id)) {
        next.delete(layer.id);
        setZOverrides((current) => {
          const updated = new Map(current);
          updated.delete(layer.id);
          return updated;
        });
      } else {
        next.add(layer.id);
      }
      return next;
    });
  };

  const onToggleMany = (layers, nextOn) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      layers.forEach((layer) => {
        const isSelected = next.has(layer.id);
        if (nextOn && !isSelected) {
          next.add(layer.id);
        }
        if (!nextOn && isSelected) {
          next.delete(layer.id);
        }
      });

      return next;
    });
  };

  const effectiveZ = (id) => {
    const layer = layerIndex[id];
    if (!layer) return 400;
    return zOverrides.get(id) ?? layer.defaultZ ?? 400;
  };

  const bumpZ = (id, delta = 100) => {
    setZOverrides((previous) => {
      const next = new Map(previous);
      next.set(id, effectiveZ(id) + delta);
      return next;
    });
  };

  const moveTop = (id) => {
    const max = [...selectedIds].reduce((current, layerId) => Math.max(current, effectiveZ(layerId)), 400);
    setZOverrides((previous) => {
      const next = new Map(previous);
      next.set(id, max + 100);
      return next;
    });
  };

  const moveBottom = (id) => {
    const min = [...selectedIds].reduce((current, layerId) => Math.min(current, effectiveZ(layerId)), 400);
    setZOverrides((previous) => {
      const next = new Map(previous);
      next.set(id, min - 100);
      return next;
    });
  };

  const setZExact = (id, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setZOverrides((previous) => {
      const next = new Map(previous);
      next.set(id, numeric);
      return next;
    });
  };

  const setLayerOpacity = (id, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const clamped = Math.max(0, Math.min(1, numeric));

    setOpacityOverrides((previous) => {
      const next = new Map(previous);
      next.set(id, clamped);
      return next;
    });
  };

  const setManyLayerOpacity = (ids, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const clamped = Math.max(0, Math.min(1, numeric));

    setOpacityOverrides((previous) => {
      const next = new Map(previous);
      ids.forEach((id) => next.set(id, clamped));
      return next;
    });
  };

  const resetToDefaults = useCallback(() => {
    const { defaultIds } = buildDefaultSelectionState();
    setSelectedIds(defaultIds);
    setZOverrides(new Map());
    setOpacityOverrides(new Map());
  }, [buildDefaultSelectionState]);

  const selectedLayers = useMemo(
    () => [...selectedIds].map((id) => layerIndex[id]).filter(Boolean),
    [layerIndex, selectedIds]
  );

  const zMap = useMemo(
    () =>
      Object.fromEntries(
        selectedLayers.map((layer) => [layer.id, zOverrides.get(layer.id) ?? layer.defaultZ ?? 400])
      ),
    [selectedLayers, zOverrides]
  );

  const opacityMap = useMemo(
    () =>
      Object.fromEntries(
        selectedLayers.map((layer) => [layer.id, opacityOverrides.get(layer.id) ?? 1])
      ),
    [opacityOverrides, selectedLayers]
  );

  const legendList = useMemo(() => {
    const byKey = new Map();

    selectedLayers.forEach((layer, index) => {
      if (!layer?.hasLegend || !layer.legendKey) return;

      const current =
        byKey.get(layer.legendKey) ||
        {
          legendKey: layer.legendKey,
          title: layer.legendTitle ?? layer.name ?? layer.legendKey,
          seq: index,
          items: new Map(),
          extras: new Map(),
        };

      current.seq = index;
      if (layer.legendItem) current.items.set(layer.legendItem, layer.legendItem);
      if (layer.legendExtra?.color && layer.legendExtra?.text) {
        const key = `${layer.legendExtra.color}::${layer.legendExtra.text}`;
        current.extras.set(key, { ...layer.legendExtra });
      }

      byKey.set(layer.legendKey, current);
    });

    return [...byKey.values()]
      .sort((a, b) => b.seq - a.seq)
      .map((record) => ({
        legendKey: record.legendKey,
        title: record.title,
        filterTexts: Array.from(record.items.values()),
        extras: Array.from(record.extras.values()),
      }));
  }, [selectedLayers]);

  return {
    layerIndex,
    selectedIds,
    selectedLayers,
    zOverrides,
    zMap,
    legendList,
    onToggleLayer,
    onToggleMany,
    bumpZ,
    moveTop,
    moveBottom,
    setZExact,
    opacityMap,
    setLayerOpacity,
    setManyLayerOpacity,
    resetToDefaults,
  };
}
