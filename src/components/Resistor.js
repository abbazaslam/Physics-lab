import { useState, useRef } from "react";
import resistorImg from "../assets/resistor.png";

function Resistor({ id = "r", resistance = 1000, wireMode = false, voltage, current, fault = false }) {
  const [position, setPosition] = useState({ x: 150, y: 150 });
  const [dragging, setDragging] = useState(false);

  const terminals = {
    left:  { id: `${id}-left`,  type: "input"  },
    right: { id: `${id}-right`, type: "output" },
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

  const showLabel = voltage !== undefined && current !== undefined;

  return (
    <div
      ref={componentRef}
      className={`component resistor${fault ? " has-fault" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        cursor: wireMode ? "default" : dragging ? "grabbing" : "grab",
      }}
    >
      <div
        className="terminal left-terminal"
        ref={(el) => { if (el && window.terminalRefs) window.terminalRefs.current[terminals.left.id] = el; }}
        onMouseDown={(e) => handleTerminalMouseDown(terminals.left, e)}
      />

      <img src={resistorImg} alt="Resistor" draggable={false} />

      <div
        className="terminal right-terminal"
        ref={(el) => { if (el && window.terminalRefs) window.terminalRefs.current[terminals.right.id] = el; }}
        onMouseDown={(e) => handleTerminalMouseDown(terminals.right, e)}
      />

      {/* Live voltage / current label from simulator */}
      {showLabel && (
        <div className="resistor-label">
          {voltage}V · {current}mA
        </div>
      )}
    </div>
  );
}

export default Resistor;