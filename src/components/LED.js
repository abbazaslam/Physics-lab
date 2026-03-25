import { useState, useRef } from "react";

// LED schematic symbol drawn with inline SVG — no image asset needed.
// Anode (+) terminal on top, cathode (−) terminal on bottom.
// The LED glows (yellow fill + rays) when `lit` prop is true.

function LED({ id = "led", wireMode = false, lit = false, fault = false }) {
  const [position, setPosition] = useState({ x: 220, y: 80 });
  const [dragging, setDragging] = useState(false);

  const terminals = {
    anode:   { id: `${id}-anode`,   type: "anode"   },  // top  (+)
    cathode: { id: `${id}-cathode`, type: "cathode" },  // bottom (−)
  };

  /* ── Terminal click → wire manager ─────────────────────────────────────── */
  const handleTerminalMouseDown = (terminal, e) => {
    e.stopPropagation();
    if (!window.handleTerminalClick) return;
    window.handleTerminalClick({ terminalId: terminal.id, element: e.target });
  };

  /* ── Drag ───────────────────────────────────────────────────────────────── */
  const componentRef = useRef(null);
  const offsetRef    = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (wireMode) return;
    if (e.target.classList.contains("terminal")) return;
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

  /* ── Colors ─────────────────────────────────────────────────────────────── */
  const bodyColor  = lit ? "#FFD700" : "#e8e8e8";
  const strokeClr  = "#1a1a1a";
  const glowColor  = "#FFD700";

  return (
    <div
      ref={componentRef}
      className={`component led-component${fault ? " has-fault" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: "absolute",
        left: position.x,
        top:  position.y,
        cursor: wireMode ? "default" : dragging ? "grabbing" : "grab",
        userSelect: "none",
        width: 48,
        // height is driven by the SVG inside
      }}
    >
      {/* ANODE terminal — top centre */}
      <div
        className="terminal top-terminal"
        style={{ position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)" }}
        ref={(el) => { if (el && window.terminalRefs) window.terminalRefs.current[terminals.anode.id] = el; }}
        onMouseDown={(e) => handleTerminalMouseDown(terminals.anode, e)}
      />

      {/* LED schematic symbol */}
      <svg
        width="48"
        height="80"
        viewBox="0 0 48 80"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Glow halo when lit */}
        {lit && (
          <circle
            cx="24" cy="40"
            r="22"
            fill={glowColor}
            opacity="0.18"
          />
        )}

        {/* Lead wire — top (anode) */}
        <line x1="24" y1="0"  x2="24" y2="18" stroke={strokeClr} strokeWidth="1.5" strokeLinecap="round" />

        {/* Diode triangle body */}
        <polygon
          points="24,18 38,42 10,42"
          fill={bodyColor}
          stroke={strokeClr}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Cathode bar */}
        <line x1="10" y1="42" x2="38" y2="42" stroke={strokeClr} strokeWidth="2" strokeLinecap="round" />

        {/* Lead wire — bottom (cathode) */}
        <line x1="24" y1="42" x2="24" y2="62" stroke={strokeClr} strokeWidth="1.5" strokeLinecap="round" />

        {/* Emission rays (always visible, brighter when lit) */}
        <g
          stroke={lit ? glowColor : "#aaa"}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={lit ? 1 : 0.5}
        >
          {/* ray 1 */}
          <line x1="36" y1="22" x2="44" y2="14" />
          <line x1="44" y1="14" x2="40" y2="14" />
          <line x1="44" y1="14" x2="44" y2="18" />
          {/* ray 2 */}
          <line x1="40" y1="28" x2="48" y2="20" />
          <line x1="48" y1="20" x2="44" y2="20" />
          <line x1="48" y1="20" x2="48" y2="24" />
        </g>

        {/* Labels */}
        <text x="24" y="75" textAnchor="middle" fontSize="9" fill="#555" fontFamily="sans-serif">LED</text>
        <text x="6"  y="16" textAnchor="middle" fontSize="8" fill="#888" fontFamily="sans-serif">+</text>
        <text x="6"  y="50" textAnchor="middle" fontSize="8" fill="#888" fontFamily="sans-serif">−</text>
      </svg>

      {/* CATHODE terminal — bottom centre */}
      <div
        className="terminal bottom-terminal"
        style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)" }}
        ref={(el) => { if (el && window.terminalRefs) window.terminalRefs.current[terminals.cathode.id] = el; }}
        onMouseDown={(e) => handleTerminalMouseDown(terminals.cathode, e)}
      />
    </div>
  );
}

export default LED;