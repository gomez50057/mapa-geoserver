"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildLayerIndex, flattenLayers } from "@/data/layerCatalog";

export function useLayerSelection(tree) {
  const layerIndex = useMemo(() => buildLayerIndex(tree), [tree]);
  const allLayers = useMemo(() => flattenLayers(tree), [tree]);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [zOverrides, setZOverrides] = useState(() => new Map());
  const [opacityOverrides, setOpacityOverrides] = useState(() => new Map());
  const legendSeq = useRef(0);
  const [legendByKey, setLegendByKey] = useState(() => new Map());

  const buildDefaultSelectionState = useCallback(() => {
    const defaults = allLayers.filter((layer) => layer.defaultVisible);
    const defaultIds = new Set(defaults.map((layer) => layer.id));
    const initialLegends = new Map();
    let sequence = 0;

    defaults.forEach((layer) => {
      if (!layer.hasLegend || !layer.legendKey) return;

      const current = initialLegends.get(layer.legendKey);
      if (current) {
        current.count += 1;
        if (layer.legendItem) current.items.add(layer.legendItem);
        if (layer.legendExtra?.color && layer.legendExtra?.text) {
          current.extras.push({ ...layer.legendExtra });
        }
      } else {
        initialLegends.set(layer.legendKey, {
          title: layer.legendTitle ?? layer.name ?? layer.legendKey,
          count: 1,
          seq: ++sequence,
          items: new Set(layer.legendItem ? [layer.legendItem] : []),
          extras:
            layer.legendExtra?.color && layer.legendExtra?.text
              ? [{ ...layer.legendExtra }]
              : [],
        });
      }
    });

    return {
      defaultIds,
      initialLegends,
      sequence,
    };
  }, [allLayers]);

  const addLegend = (layer) => {
    if (!layer?.hasLegend || !layer.legendKey) return;

    setLegendByKey((previous) => {
      const next = new Map(previous);
      const current = next.get(layer.legendKey);

      if (current) {
        current.count += 1;
        if (layer.legendItem) current.items.add(layer.legendItem);
        if (layer.legendExtra?.color && layer.legendExtra?.text) {
          current.extras.push({ ...layer.legendExtra });
        }
        current.seq = ++legendSeq.current;
      } else {
        const items = new Set();
        if (layer.legendItem) items.add(layer.legendItem);
        next.set(layer.legendKey, {
          title: layer.legendTitle ?? layer.name ?? layer.legendKey,
          count: 1,
          seq: ++legendSeq.current,
          items,
          extras:
            layer.legendExtra?.color && layer.legendExtra?.text
              ? [{ ...layer.legendExtra }]
              : [],
        });
      }

      return new Map(next);
    });
  };

  const removeLegend = (layer) => {
    if (!layer?.hasLegend || !layer.legendKey) return;

    setLegendByKey((previous) => {
      const next = new Map(previous);
      const current = next.get(layer.legendKey);
      if (!current) return previous;

      current.count -= 1;
      if (layer.legendItem) current.items.delete(layer.legendItem);
      if (current.count <= 0) next.delete(layer.legendKey);

      return new Map(next);
    });
  };

  useEffect(() => {
    const { defaultIds, initialLegends, sequence } = buildDefaultSelectionState();
    setSelectedIds(defaultIds);
    legendSeq.current = sequence;
    setLegendByKey(initialLegends);
  }, [buildDefaultSelectionState]);

  const onToggleLayer = (layer) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(layer.id)) {
        next.delete(layer.id);
        removeLegend(layer);
        setZOverrides((current) => {
          const updated = new Map(current);
          updated.delete(layer.id);
          return updated;
        });
      } else {
        next.add(layer.id);
        addLegend(layer);
      }
      return next;
    });
  };

  const onToggleMany = (layers, nextOn) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      const added = [];
      const removed = [];

      layers.forEach((layer) => {
        const isSelected = next.has(layer.id);
        if (nextOn && !isSelected) {
          next.add(layer.id);
          added.push(layer);
        }
        if (!nextOn && isSelected) {
          next.delete(layer.id);
          removed.push(layer);
        }
      });

      setLegendByKey((previousLegend) => {
        const updated = new Map(previousLegend);

        added.forEach((layer) => {
          if (!layer.hasLegend || !layer.legendKey) return;
          const current = updated.get(layer.legendKey);
          if (current) {
            current.count += 1;
            if (layer.legendItem) current.items.add(layer.legendItem);
            if (layer.legendExtra?.color && layer.legendExtra?.text) {
              current.extras.push({ ...layer.legendExtra });
            }
            current.seq = ++legendSeq.current;
          } else {
            updated.set(layer.legendKey, {
              title: layer.legendTitle ?? layer.name ?? layer.legendKey,
              count: 1,
              seq: ++legendSeq.current,
              items: new Set(layer.legendItem ? [layer.legendItem] : []),
              extras:
                layer.legendExtra?.color && layer.legendExtra?.text
                  ? [{ ...layer.legendExtra }]
                  : [],
            });
          }
        });

        removed.forEach((layer) => {
          if (!layer.hasLegend || !layer.legendKey) return;
          const current = updated.get(layer.legendKey);
          if (!current) return;
          current.count -= 1;
          if (layer.legendItem) current.items.delete(layer.legendItem);
          if (current.count <= 0) updated.delete(layer.legendKey);
        });

        return new Map(updated);
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
    const { defaultIds, initialLegends, sequence } = buildDefaultSelectionState();
    setSelectedIds(defaultIds);
    setZOverrides(new Map());
    setOpacityOverrides(new Map());
    legendSeq.current = sequence;
    setLegendByKey(initialLegends);
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

  const legendList = useMemo(
    () =>
      [...legendByKey.entries()]
        .sort((a, b) => b[1].seq - a[1].seq)
        .map(([legendKey, record]) => ({
          legendKey,
          title: record.title,
          filterTexts: Array.from(record.items || []),
          extras: record.extras || [],
        })),
    [legendByKey]
  );

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
