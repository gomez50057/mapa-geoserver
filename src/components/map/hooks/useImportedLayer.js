import { useCallback, useState } from "react";
import L from "leaflet";
import {
  createImportedLayer,
  MAX_IMPORT_FILE_SIZE_BYTES,
  parseImportedFile,
  readFileAsText,
  validateImportedFile,
} from "../utils/importUtils";
import { escapeHtml } from "../utils/shared";

export function useImportedLayer({
  mapRef,
  importedOverlayRef,
  importInputRef,
}) {
  const [importPanelState, setImportPanelState] = useState({
    open: false,
    loading: false,
    error: "",
  });
  const [importSanitizeHelpOpen, setImportSanitizeHelpOpen] = useState(false);

  const closeImportPanel = useCallback(() => {
    setImportPanelState((current) => ({ ...current, open: false, loading: false, error: "" }));
    setImportSanitizeHelpOpen(false);
    if (importInputRef.current) importInputRef.current.value = "";
  }, [importInputRef]);

  const openImportPanel = useCallback(() => {
    setImportPanelState((current) => ({ ...current, open: true, loading: false, error: "" }));
  }, []);

  const handleImportedFile = useCallback(
    async (file) => {
      const map = mapRef.current;
      if (!map || !file) return;

      const importValidationError = validateImportedFile(file);
      if (importValidationError) {
        setImportPanelState((current) => ({
          ...current,
          open: true,
          loading: false,
          error: importValidationError,
        }));
        return;
      }

      if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
        setImportPanelState((current) => ({
          ...current,
          open: true,
          loading: false,
          error: "Limita tus archivos a 12 MB.",
        }));
        return;
      }

      setImportPanelState((current) => ({
        ...current,
        open: true,
        loading: true,
        error: "",
      }));

      try {
        const text = await readFileAsText(file);
        const geojson = parseImportedFile(file.name, text);

        if (importedOverlayRef.current) {
          importedOverlayRef.current.remove();
          importedOverlayRef.current = null;
        }

        const layer = createImportedLayer(map, geojson, file.name).addTo(map);
        importedOverlayRef.current = layer;

        const bounds = layer.getBounds?.();
        if (bounds?.isValid?.()) {
          map.flyToBounds(bounds, {
            padding: [30, 30],
            maxZoom: 16,
            duration: 0.75,
          });
        }

        L.popup({ autoClose: true, closeButton: false, offset: [0, -16] })
          .setLatLng(map.getCenter())
          .setContent(
            `<div style="font-family:Montserrat,sans-serif;font-size:12px;color:#222;padding:2px 4px;">
              <strong style="color:#1d6fa5;display:block;margin-bottom:2px;">Archivo importado</strong>
              <span style="display:block;background:rgba(29,111,165,0.08);padding:6px 8px;border-radius:10px;">${escapeHtml(file.name)}</span>
            </div>`
          )
          .openOn(map);

        closeImportPanel();
      } catch (error) {
        console.error("Import failed", error);
        setImportPanelState((current) => ({
          ...current,
          open: true,
          loading: false,
          error: error?.message || "No se pudo importar el archivo.",
        }));
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    },
    [closeImportPanel, importInputRef, importedOverlayRef, mapRef]
  );

  return {
    importPanelState,
    importSanitizeHelpOpen,
    setImportSanitizeHelpOpen,
    openImportPanel,
    closeImportPanel,
    handleImportedFile,
  };
}
