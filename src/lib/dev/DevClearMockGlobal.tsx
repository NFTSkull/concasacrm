"use client";

import { useEffect } from "react";
import { registerClearMockDataGlobal } from "./clearMockData";

/**
 * En desarrollo, expone `window.clearMockData()` para limpiar mocks desde la consola.
 */
export function DevClearMockGlobal() {
  useEffect(() => {
    registerClearMockDataGlobal();
  }, []);
  return null;
}
