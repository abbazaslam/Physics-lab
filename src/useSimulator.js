import { useMemo, useEffect, useRef, useState } from "react";
import { simulate } from "./simulator";

export function useSimulator(components, wires) {
  // "checking" flashes briefly when any PSU is turned ON
  const [checking, setChecking] = useState(false);
  const prevAnyOn = useRef(false);

  const anyPsuOn = components.some(c => c.type === "power" && c.on !== false);

  useEffect(() => {
    // Detect the moment a PSU transitions from OFF → ON
    if (anyPsuOn && !prevAnyOn.current) {
      setChecking(true);
      const t = setTimeout(() => setChecking(false), 600);
      prevAnyOn.current = true;
      return () => clearTimeout(t);
    }
    if (!anyPsuOn) prevAnyOn.current = false;
  }, [anyPsuOn]);

  const simData = useMemo(() => {
    if (!components.length) return { results: {}, faults: [] };
    try {
      const { results, faults } = simulate(components, wires);
      return { results, faults };
    } catch (e) {
      console.warn("Simulator error:", e);
      return {
        results: {},
        faults: [{ type: "error", message: "Simulation error: " + e.message }],
      };
    }
  }, [components, wires]);

  return { ...simData, checking };
}