import { useState, useRef } from "react";
import powerImg from "../assets/power-supply.png";

function PowerSupply({ id = "ps", wireMode = false, fault = false, on = true, onToggle }) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);

  const terminals = {
    top:    { id: `${id}-positive`, type: "positive" },
    bottom: { id: `${id}-negative`, type: "negative" },
  };

  const handleTerminalMouseDown = (terminal, e) => {
    e.stopPropagation();
    if (!window.handleTerminalClick) return;
    window.handleTerminalClick({ terminalId: terminal.id, element: e.target });
  };

  const componentRef = useRef(null);
  const offsetRef    = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (wireMode) return;
    if (e.target.classList.contains("terminal")) return;
    if (e.target.closest(".psu-toggle")) return; // don't drag when clicking toggle
    e.preventDefault();
    setDragging(true);
    const rect = componentRef.current.getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const parent     = componentRef.current.parentElement;
    const parentRect = parent.getBoundingClientRect();
    const compRect   = componentRef.current.getBoundingClientRect();
    let newX = e.clientX - parentRect.left - offsetRef.current.x;
    let newY = e.clientY - parentRect.top  - offsetRef.current.y;
    newX = Math.max(0, Math.min(newX, parentRect.width  - compRect.width));
    newY = Math.max(0, Math.min(newY, parentRect.height - compRect.height));
    setPosition({ x: newX, y: newY });
    window.notifyLayoutChange?.();
  };

  const handleMouseUp = () => setDragging(false);

  return (
    <div
      ref={componentRef}
      className={`component power-supply${fault ? " has-fault" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: "absolute",
        left: position.x,
        top:  position.y,
        cursor: wireMode ? "default" : dragging ? "grabbing" : "grab",
      }}
    >
      {/* TOP TERMINAL (+) */}
      <div
        className="terminal top-terminal"
        ref={(el) => { if (el && window.terminalRefs) window.terminalRefs.current[terminals.top.id] = el; }}
        onMouseDown={(e) => handleTerminalMouseDown(terminals.top, e)}
      />

      <img src={powerImg} alt="Power Supply" draggable={false} />

      {/* BOTTOM TERMINAL (−) */}
      <div
        className="terminal bottom-terminal"
        ref={(el) => { if (el && window.terminalRefs) window.terminalRefs.current[terminals.bottom.id] = el; }}
        onMouseDown={(e) => handleTerminalMouseDown(terminals.bottom, e)}
      />

      {/* ON / OFF toggle button below the image */}
      <div
        className="psu-toggle"
        onClick={(e) => { e.stopPropagation(); onToggle?.(id); }}
        style={{
          textAlign:    "center",
          marginTop:    4,
          cursor:       "pointer",
          userSelect:   "none",
        }}
      >
        <span style={{
          display:      "inline-block",
          padding:      "2px 10px",
          borderRadius: 10,
          fontSize:     10,
          fontWeight:   700,
          background:   on ? "#1D9E75" : "#ccc",
          color:        on ? "#fff"    : "#666",
          transition:   "background 0.2s",
          letterSpacing: "0.05em",
        }}>
          {on ? "ON" : "OFF"}
        </span>
      </div>
    </div>
  );
}

export default PowerSupply;