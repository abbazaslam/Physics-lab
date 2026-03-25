import { useRef, useState } from "react";
import "./App.css";
import { PowerSupply, Resistor, Ground } from "./components";
import LED from "./components/LED";
import { WireLayer, WireToolbar, WireHint, useWireManager } from "./components/Wire";
import { useSimulator } from "./useSimulator";

const FAULT_ICON = {
  short_circuit:    "⚡",
  reverse_polarity: "↩️",
  floating:         "🔌",
  short_self:       "〰️",
  open_circuit:     "✂️",
  no_ground:        "⏚",
  error:            "⚠️",
};

function App() {
  const terminalRefs = useRef({});
  const canvasRef    = useRef(null);
  window.terminalRefs = terminalRefs;

  const wire = useWireManager(terminalRefs, canvasRef);

  const [components, setComponents] = useState([]);

  const addComponent = (type) =>
    setComponents((prev) => [
      ...prev,
      {
        id:   `${type}-${Date.now()}`,
        type,
        ...(type === "resistor" && { resistance: 1000 }),
        ...(type === "power"    && { voltage: 5, on: false }), // starts OFF
      },
    ]);

  const handlePsuToggle = (id) =>
    setComponents((prev) =>
      prev.map((c) => c.id === id ? { ...c, on: !c.on } : c)
    );

  const { results: simResults, faults, checking } = useSimulator(components, wire.wires);

  const anyPsuOn  = components.some(c => c.type === "power" && c.on !== false);
  const faultIds  = new Set(faults.filter(f => f.componentId).map(f => f.componentId));
  const hasFaults = faults.length > 0;

  const canvasCursor = wire.dragState
    ? "grabbing"
    : wire.wireMode
    ? "crosshair"
    : "default";

  return (
    <div className="app-container">

      {/* LEFT PANEL */}
      <div className="left-panel">
        <button className="tool-button" onClick={() => addComponent("power")}>Power Supply</button>
        <button className="tool-button" onClick={() => addComponent("resistor")}>Resistor</button>
        <button className="tool-button" onClick={() => addComponent("ground")}>Ground</button>
        <button className="tool-button" onClick={() => addComponent("led")}>LED</button>

        <WireToolbar
          wireMode={wire.wireMode}
          setWireMode={wire.setWireMode}
          onUndo={wire.undoWire}
          onClear={wire.clearWires}
          canUndo={wire.wires.length > 0}
        />

        {/* Checking indicator */}
        {checking && (
          <div className="sim-checking">
            <span className="sim-checking-dot" />
            Checking circuit…
          </div>
        )}

        {/* Fault warnings — only shown when PSU is ON */}
        {!checking && anyPsuOn && hasFaults && (
          <div className="fault-panel">
            <div className="fault-title">⚠ Circuit Error</div>
            {faults.map((f, i) => (
              <div key={i} className={`fault-row fault-${f.type}`}>
                <span className="fault-icon">{FAULT_ICON[f.type] ?? "⚠️"}</span>
                <span className="fault-msg">{f.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Simulation readout — only when PSU ON and no faults */}
        {!checking && anyPsuOn && !hasFaults && components.length > 0 && (
          <div className="sim-panel">
            <div className="sim-title">Simulation</div>
            {components.map((c) => {
              const r = simResults[c.id];
              return (
                <div key={c.id} className="sim-row">
                  <span className="sim-label">
                    {c.type === "power"    && `⚡ PSU`}
                    {c.type === "resistor" && "≋ Resistor"}
                    {c.type === "led"      && "💡 LED"}
                    {c.type === "ground"   && "⏚ GND"}
                  </span>
                  <span className="sim-values">
                    {!r && <span className="sim-nc">–</span>}
                    {r && c.type === "power"    && <>{r.voltage}V · {r.current}mA · {r.power}mW</>}
                    {r && c.type === "resistor" && <>{r.voltage}V · {r.current}mA · {r.power}mW</>}
                    {r && c.type === "led"      && (
                      <>
                        <span style={{ color: r.lit ? "#f5a623" : "#999" }}>
                          {r.lit ? "● ON" : "○ OFF"}
                        </span>
                        {r.lit && ` · ${r.voltage}V · ${r.current}mA`}
                      </>
                    )}
                    {r && c.type === "ground" && <>0V</>}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Idle hint — PSU exists but is off */}
        {!anyPsuOn && components.some(c => c.type === "power") && (
          <div className="sim-idle">
            Turn on a Power Supply to run the simulation.
          </div>
        )}
      </div>

      {/* CANVAS */}
      <div
        ref={canvasRef}
        className="right-panel"
        style={{ cursor: canvasCursor }}
        {...wire.canvasProps}
      >
        {components.map((c) => {
          const r        = simResults[c.id];
          const hasFault = faultIds.has(c.id);
          const props    = { key: c.id, id: c.id, wireMode: wire.wireMode, fault: hasFault };

          if (c.type === "power")
            return <PowerSupply {...props} on={c.on} onToggle={handlePsuToggle} />;
          if (c.type === "resistor")
            return <Resistor {...props} voltage={r?.voltage} current={r?.current} />;
          if (c.type === "ground")
            return <Ground {...props} />;
          if (c.type === "led")
            return <LED {...props} lit={r?.lit ?? false} />;
          return null;
        })}

        <WireLayer
          key={wire.layoutTick}
          wires={wire.wires}
          activeWire={wire.activeWire}
          terminalRefs={terminalRefs}
          canvasRef={canvasRef}
          dragState={wire.dragState}
        />

        {wire.wireMode && <WireHint activeWire={wire.activeWire} />}
      </div>

    </div>
  );
}

export default App;