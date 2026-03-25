//ground.js
import { useState, useRef } from "react";
import groundImg from "../assets/ground.png";

function Ground() {
  const [position, setPosition] = useState({ x: 250, y: 250 });
  const [dragging, setDragging] = useState(false);

  /* ---- SINGLE TERMINAL ---- */
  const [terminal] = useState({
    id: "gnd",
    type: "ground",
    nodeId: 0,
    voltage: 0,
  });

  const componentRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleTerminalMouseDown = (terminal, e) => {
    e.stopPropagation();
    if (!window.handleTerminalClick) return;

    window.handleTerminalClick({
      terminalId: terminal.id,
      element: e.target,
    });
  };

  const handleMouseDown = (e) => {
    if (e.target.classList.contains("terminal")) return;

    e.preventDefault();
    setDragging(true);

    const rect = componentRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;

    const parent = componentRef.current.parentElement;
    const parentRect = parent.getBoundingClientRect();
    const compRect = componentRef.current.getBoundingClientRect();

    let newX = e.clientX - parentRect.left - offsetRef.current.x;
    let newY = e.clientY - parentRect.top - offsetRef.current.y;

    newX = Math.max(0, Math.min(newX, parentRect.width - compRect.width));
    newY = Math.max(0, Math.min(newY, parentRect.height - compRect.height));

    setPosition({ x: newX, y: newY });

    if (window.notifyLayoutChange) {
      window.notifyLayoutChange();
    }
  };

  const handleMouseUp = () => setDragging(false);

  return (
    <div
      ref={componentRef}
      className="component ground"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        cursor: dragging ? "grabbing" : "grab",
      }}
    >
      {/* GROUND TERMINAL (TOP) */}
      <div
        className="terminal top-terminal"
        ref={(el) => {
          if (el && window.terminalRefs) {
            window.terminalRefs.current[terminal.id] = el;
          }
        }}
        onMouseDown={(e) => handleTerminalMouseDown(terminal, e)}
      />

      <img src={groundImg} alt="Ground" draggable={false} />
    </div>
  );
}

export default Ground;
