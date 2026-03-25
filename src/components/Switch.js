import { useState, useRef } from "react";

function Switch({ id = "sw", wireMode = false, closed = true, onToggle, fault = false }) {
  const [position, setPosition] = useState({ x: 180, y: 180 });
  const [dragging, setDragging] = useState(false);

  const terminals = {
    left:  { id: `${id}-left`  },
    right: { id: `${id}-right` },
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

  const handleToggle = (e) => {
    e.stopPropagation();
    if (wireMode) return;
    if (dragging) return;
    onToggle?.(id);
  };

  const stroke = "#1a1a1a";

  // Bar pivot is at left terminal (x=8,y=24)
  // Bar tip when closed: x=56,y=24 (flat)
  // Bar tip when open:   x=44,y=10 (tilted ~30° up)
  const barTipX = closed ? 52 : 42;
  const barTipY = closed ? 24 : 10;

  return (
    <div
      ref={componentRef}
      className={`component switch-component${fault ? " has-fault" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position:   "absolute",
        left:       position.x,
        top:        position.y,
        width:      72,
        cursor:     wireMode ? "default" : dragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      {/* LEFT terminal */}
      <div
        className="terminal left-terminal"
        style={{ position: "absolute", left: -5, top: "50%", transform: "translateY(-50%)" }}
        ref={(el) => { if (el && window.terminalRefs) window.terminalRefs.current[terminals.left.id] = el; }}
        onMouseDown={(e) => handleTerminalMouseDown(terminals.left, e)}
      />

      <svg
        width="72" height="48"
        viewBox="0 0 72 48"
        style={{ display: "block", overflow: "visible", cursor: wireMode ? "default" : "pointer" }}
        onClick={handleToggle}
      >
        {/* Left lead wire */}
        <line x1="0"  y1="24" x2="14" y2="24" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />

        {/* Left terminal circle */}
        <circle cx="14" cy="24" r="3" fill="white" stroke={stroke} strokeWidth="1.5" />

        {/* Right terminal circle */}
        <circle cx="58" cy="24" r="3" fill="white" stroke={stroke} strokeWidth="1.5" />

        {/* Right lead wire */}
        <line x1="61" y1="24" x2="72" y2="24" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />

        {/* Switch bar — flat when closed, tilted when open */}
        <line
          x1="17" y1="24"
          x2={barTipX} y2={barTipY}
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transition: "all 0.15s ease" }}
        />

        {/* State label */}
        <text
          x="36" y="44"
          textAnchor="middle"
          fontSize="9"
          fill={closed ? "#1D9E75" : "#E24B4A"}
          fontFamily="sans-serif"
          fontWeight="600"
        >
          {closed ? "CLOSED" : "OPEN"}
        </text>

        {/* Component label */}
        <text
          x="36" y="8"
          textAnchor="middle"
          fontSize="8"
          fill="#888"
          fontFamily="sans-serif"
        >
          SW
        </text>
      </svg>

      {/* RIGHT terminal */}
      <div
        className="terminal right-terminal"
        style={{ position: "absolute", right: -5, top: "50%", transform: "translateY(-50%)" }}
        ref={(el) => { if (el && window.terminalRefs) window.terminalRefs.current[terminals.right.id] = el; }}
        onMouseDown={(e) => handleTerminalMouseDown(terminals.right, e)}
      />
    </div>
  );
}

export default Switch;