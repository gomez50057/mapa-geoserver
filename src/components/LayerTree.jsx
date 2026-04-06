"use client";
import React, { useMemo, useRef, useEffect, useState } from "react";
import styles from "./LayerTree.module.css";

/* === Utilidades === */
function isLeaf(node) {
  return node && node.id && !node.children && !node.layers;
}

/** Recolecta TODAS las hojas (capas) bajo un nodo (recursivo) */
function collectLeafLayers(node) {
  if (!node) return [];
  if (Array.isArray(node.layers)) return node.layers.slice();
  const out = [];
  (node.children || []).forEach((ch) => out.push(...collectLeafLayers(ch)));
  return out;
}

/* === Menú de herramientas (tuerca) — opcional, pero compatible === */
function ToolsMenu({ id, zCurrent = 400, onZTop, onZUp, onZDown, onZBottom, onZSet }) {
  const [val, setVal] = useState(zCurrent);
  const detailsRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => { setVal(zCurrent); }, [zCurrent]);

  // Auto-flip del panel para no salirse de la pantalla
  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    const onToggle = () => {
      if (!el.open) return;
      const panel = panelRef.current;
      if (!panel) return;
      el.dataset.pos = "";
      const rect = panel.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight, margin = 8;
      const pos = [];
      if (rect.right > vw - margin) pos.push("left");
      if (rect.bottom > vh - margin) pos.push("up");
      el.dataset.pos = pos.join(" ");
    };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, []);

  const pct = ((val - (-1000)) * 100) / (2000 - (-1000));

  return (
    <details ref={detailsRef} className={styles.tools} onClick={(e) => e.stopPropagation()}>
      <summary
        className={styles.toolsBtn}
        aria-label="Herramientas de orden"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        {/* ícono tuerca */}
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M12 15.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7m8.94-2.61l-1.66.96c.04.36.07.72.07 1.09s-.03.73-.07 1.09l1.66.96c.19.11.27.35.18.56a9.984 9.984 0 0 1-2.01 3.48c-.15.17-.39.21-.58.1l-1.66-.96c-.57.46-1.2.83-1.88 1.12l-.25 1.91c-.03.22-.22.39-.45.39h-4c-.23 0-.42-.17-.45-.39l-.25-1.91c-.68-.29-1.31-.66-1.88-1.12l-1.66.96c-.19.11-.43.07-.58-.1a9.984 9.984 0 0 1-2.01-3.48a.46.46 0 0 1 .18-.56l1.66-.96A8.74 8.74 0 0 1 3 15.98c0-.37.03-.73.07-1.09l-1.66-.96a.46.46 0 0 1-.18-.56a9.984 9.984 0 0 1 2.01-3.48c.15-.17.39-.21.58-.1l1.66.96c.57-.46 1.2-.83 1.88-1.12l1.66-.96c.19-.11.43-.07.58.1a9.984 9.984 0 0 1 2.01 3.48c.09.21.01.45-.18.56" />
        </svg>
      </summary>

      <div ref={panelRef} className={styles.toolsPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.toolsRow}>
          <input
            type="range"
            min={-1000}
            max={2000}
            step={10}
            value={val}
            onChange={(e) => setVal(Number(e.target.value))}
            onPointerUp={() => onZSet?.(id, val)}
            onKeyDown={(e) => { if (e.key === "Enter") onZSet?.(id, val); }}
            className={styles.zslider}
            style={{ "--filled": `${pct}%` }}
          />
          <span className={styles.zbadge}>z:{val}</span>
        </div>

        <div className={styles.toolsRow}>
          <button type="button" title="Traer al frente (Top)" onClick={() => onZTop?.(id)}>⤒</button>
          <button type="button" title="Subir (▲). Shift = +500" onClick={(e) => onZUp?.(id, e.shiftKey)}>▲</button>
          <button type="button" title="Bajar (▼). Shift = -500" onClick={(e) => onZDown?.(id, e.shiftKey)}>▼</button>
          <button type="button" title="Enviar atrás (Bottom)" onClick={() => onZBottom?.(id)}>⤓</button>
        </div>

        <div className={styles.toolsRow}>
          <input
            type="number"
            className={styles.zinput}
            placeholder="z exacto"
            value={val}
            onChange={(e) => setVal(Number(e.target.value || 0))}
            onBlur={(e) => { if (e.currentTarget.value !== "") onZSet?.(id, Number(e.currentTarget.value)); }}
            onKeyDown={(e) => { if (e.key === "Enter") onZSet?.(id, Number(e.currentTarget.value)); }}
          />
        </div>

        <div className={styles.toolsHint}>Tip: usa Shift para saltar ±500</div>
      </div>
    </details>
  );
}

/* === Nodo del árbol === */
function Node({
  node,
  level = 1,
  selected = new Set(),
  onToggle = () => { },
  onToggleMany = () => { },
  onZUp,
  onZDown,
  onZTop,
  onZBottom,
  onZSet,
  zMap = {},
}) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const hasLayers = Array.isArray(node.layers) && node.layers.length > 0;

  // Estado del grupo (checkbox maestro) a partir de sus hojas
  const leafs = useMemo(() => collectLeafLayers(node), [node]);
  const { allOn, someOn } = useMemo(() => {
    if (!leafs.length) return { allOn: false, someOn: false };
    let onCount = 0;
    for (const l of leafs) if (selected.has(l.id)) onCount++;
    return { allOn: onCount === leafs.length, someOn: onCount > 0 && onCount < leafs.length };
  }, [leafs, selected]);

  if (!isLeaf(node)) {
    return (
      <div className={styles.node} data-level={level}>
        {/* ✅ Cerrado por defecto: se quitó `open` */}
        <details className={styles.group}>
          <summary className={styles.summary}>
            {/* Checkbox de grupo: enciende/apaga TODAS las hojas del nivel */}
            {leafs.length > 0 && (
              <input
                type="checkbox"
                checked={allOn}
                ref={(el) => { if (el) el.indeterminate = someOn; }}
                onChange={(e) => onToggleMany(leafs, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                style={{ marginRight: 8 }}
                title="Activar/Desactivar todas las capas de este grupo"
              />
            )}
            {node.name}
          </summary>

          {/* subcarpetas */}
          {hasChildren && node.children.map((ch) => (
            <Node
              key={ch.id || ch.name}
              node={ch}
              level={Math.min(level + 1, 4)}
              selected={selected}
              onToggle={onToggle}
              onToggleMany={onToggleMany}
              onZUp={onZUp}
              onZDown={onZDown}
              onZTop={onZTop}
              onZBottom={onZBottom}
              onZSet={onZSet}
              zMap={zMap}
            />
          ))}

          {/* hojas (capas) */}
          {hasLayers && node.layers.map((layer) => {
            const isOn = selected.has(layer.id);
            const currentZ = zMap?.[layer.id] ?? (layer.defaultZ ?? 400);
            return (
              <div key={layer.id} className={styles.leaf}>
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => onToggle(layer)}
                />
                <span>{layer.name}</span>
                <span className={styles.zval}>z:{currentZ}</span>

                <ToolsMenu
                  id={layer.id}
                  zCurrent={currentZ}
                  onZTop={onZTop}
                  onZUp={onZUp}
                  onZDown={onZDown}
                  onZBottom={onZBottom}
                  onZSet={onZSet}
                />
              </div>
            );
          })}
        </details>
      </div>
    );
  }

  // Hoja suelta
  const isOn = selected.has(node.id);
  const currentZ = zMap?.[node.id] ?? (node.defaultZ ?? 400);
  return (
    <div className={styles.leaf}>
      <input type="checkbox" checked={isOn} onChange={() => onToggle(node)} />
      <span>{node.name}</span>
      <span className={styles.zval}>z:{currentZ}</span>
      <ToolsMenu
        id={node.id}
        zCurrent={currentZ}
        onZTop={onZTop}
        onZUp={onZUp}
        onZDown={onZDown}
        onZBottom={onZBottom}
        onZSet={onZSet}
      />
    </div>
  );
}

/* === Export principal === */
export default function LayerTree({
  tree = [],
  selected = new Set(),
  onToggle = () => { },
  onToggleMany = () => { },
  onZUp = () => { },
  onZDown = () => { },
  onZTop = () => { },
  onZBottom = () => { },
  onZSet = () => { },
  zMap = {},
}) {
  return (
    <aside className={styles.sidebar}>
      {tree.map((root) => (
        <Node
          key={root.id || root.name}
          node={root}
          level={1}
          selected={selected}
          onToggle={onToggle}
          onToggleMany={onToggleMany}
          onZUp={onZUp}
          onZDown={onZDown}
          onZTop={onZTop}
          onZBottom={onZBottom}
          onZSet={onZSet}
          zMap={zMap}
        />
      ))}
    </aside>
  );
}
