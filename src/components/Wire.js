

import { useEffect, useState, useRef, useCallback } from "react";
 
// ─── Pure helpers ─────────────────────────────────────────────────────────────
 
export function getOrthogonalSnap(from, to, lastDir) {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (!lastDir) {
    return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  }
  return lastDir === "h" ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}
 
export function pointsToPath(pts) {
  if (!pts || pts.length < 2) return "";
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}
 
// ─── resolveWirePoints ────────────────────────────────────────────────────────
// Rebuilds a finished wire's pixel path live from current terminal DOM positions.
// Returns both the resolved points array AND per-segment metadata needed for
// hit-testing and dragging.
 
function resolveWirePoints(wire, terminalRefs, canvasEl) {
  if (!canvasEl) return { pts: wire.points || [], segments: [] };
 
  const getPos = (id) => {
    const el = terminalRefs.current?.[id];
    if (!el) return null;
    const tR = el.getBoundingClientRect();
    const cR = canvasEl.getBoundingClientRect();
    return {
      x: tR.left - cR.left + tR.width  / 2,
      y: tR.top  - cR.top  + tR.height / 2,
    };
  };
 
  const start = getPos(wire.from);
  const end   = getPos(wire.to);
  if (!start || !end) return { pts: wire.points || [], segments: [] };
 
  const origStart = wire.points[0];
  const dx = start.x - origStart.x;
  const dy = start.y - origStart.y;
 
  const mids = wire.midPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  const prev = mids.length > 0 ? mids[mids.length - 1] : start;
  const finalSnap = getOrthogonalSnap(prev, end, wire.lastMidDir || null);
 
  const pts = [start, ...mids];
  if (finalSnap.x !== prev.x || finalSnap.y !== prev.y) pts.push(finalSnap);
  const lastPt = pts[pts.length - 1];
  if (lastPt.x !== end.x || lastPt.y !== end.y) pts.push(end);
 
  // Build segment descriptors: each segment knows its index in pts, axis, and
  // which midPoint indices it "owns" for dragging purposes.
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const isH = Math.abs(b.y - a.y) < 1; // horizontal if Y barely changes
    segments.push({ i, a, b, isH });
  }
 
  return { pts, segments };
}
 
// ─── Hit test: is a point within HIT_DIST px of a line segment? ──────────────
const HIT_DIST = 8;
 
function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
 
function hitTestWire(resolvedSegments, cx, cy) {
  for (const seg of resolvedSegments) {
    const d = distPointToSegment(cx, cy, seg.a.x, seg.a.y, seg.b.x, seg.b.y);
    if (d <= HIT_DIST) return seg;
  }
  return null;
}
 
// ─── WireToolbar ─────────────────────────────────────────────────────────────
 
export function WireToolbar({ wireMode, setWireMode, onUndo, onClear, canUndo }) {
  return (
    <>
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)", margin: "8px 0" }} />
 
      <button
        className={`tool-button wire-button ${wireMode ? "active" : ""}`}
        onClick={() => setWireMode(!wireMode)}
      >
        {wireMode ? "✕  Wire" : "⌇  Wire"}
      </button>
 
      <button
        className="tool-button"
        onClick={onUndo}
        disabled={!canUndo}
        style={{ opacity: canUndo ? 1 : 0.4 }}
      >
        ↩ Undo Wire
      </button>
 
      <button
        className="tool-button"
        onClick={onClear}
        disabled={!canUndo}
        style={{ opacity: canUndo ? 1 : 0.4 }}
      >
        ✕ Clear Wires
      </button>
    </>
  );
}
 
// ─── WireLayer ────────────────────────────────────────────────────────────────
 
export function WireLayer({ wires, activeWire, terminalRefs, canvasRef, dragState }) {
  const buildPreviewPath = () => {
    if (!activeWire || !activeWire.previewEnd) return "";
    const segs = activeWire.segments;
    const last = segs[segs.length - 1];
    const snap = getOrthogonalSnap(last, activeWire.previewEnd, activeWire.lastDir);
    const pts  = [...segs];
    if (snap.x !== last.x || snap.y !== last.y) pts.push(snap);
    pts.push(activeWire.previewEnd);
    return pointsToPath(pts);
  };
 
  return (
    <svg
      style={{
        position: "absolute",
        top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 5,
      }}
    >
      {wires.map((w) => {
        const { pts } = resolveWirePoints(w, terminalRefs, canvasRef.current);
        const isDragging = dragState?.wireId === w.id;
        return (
          <path
            key={w.id}
            d={pointsToPath(pts)}
            fill="none"
            stroke={isDragging ? "#378ADD" : "#1a1a1a"}
            strokeWidth={isDragging ? 2.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
 
      {activeWire && activeWire.segments.length >= 1 && (
        <path
          d={pointsToPath(activeWire.segments)}
          fill="none"
          stroke="#378ADD"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
 
      {activeWire && activeWire.previewEnd && (
        <path
          d={buildPreviewPath()}
          fill="none"
          stroke="#378ADD"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 4"
          opacity={0.7}
        />
      )}
    </svg>
  );
}
 
// ─── WireHint ─────────────────────────────────────────────────────────────────
 
export function WireHint({ activeWire }) {
  return (
    <div className="wire-hint">
      {activeWire
        ? "Click to bend  ·  Click a terminal to finish  ·  Esc to cancel"
        : "Click a terminal to start  ·  Drag a wire segment to move it"}
    </div>
  );
}
 
// ─── useWireManager ───────────────────────────────────────────────────────
 
export function useWireManager(terminalRefs, canvasRef) {
  const [wires,      setWires]         = useState([]);// all completed wire connections
  const [activeWire, setActiveWire]    = useState(null);// the wire currently being drawn (drives the dashed preview)
  const [wireMode,   setWireModeState] = useState(false);// whether the wire tool is active
  const [layoutTick, setLayoutTick]    = useState(0);// a counter that increments on every component drag, forcing wires to redraw at updated positions
  // dragState: { wireId, segIndex, axis:'h'|'v', startMouse, origMidPoints }
  const [dragState,  setDragState]     = useState(null);
 
  const activeWireRef = useRef(null);
  const wireModeRef   = useRef(false);
  const dragStateRef  = useRef(null);
 
  // Keep syncActiveWire in a ref so stable useCallback closures always
  // call the latest version — fixes the stale-closure / multiple-bend bug.
  const syncActiveWireRef = useRef(null);
  syncActiveWireRef.current = (val) => {
    activeWireRef.current = val;
    setActiveWire(val);
  };
  const syncActiveWire = (val) => syncActiveWireRef.current(val);
 
  const syncDragState = (val) => {
    dragStateRef.current = val;
    setDragState(val);
  };
 
  useEffect(() => {
    window.notifyLayoutChange = () => setLayoutTick((t) => t + 1);
  }, []);
 
  const setWireMode = (val) => {
    wireModeRef.current = val;
    setWireModeState(val);
    if (!val) syncActiveWire(null);
  };
 
  const undoWire  = () => setWires((ws) => ws.slice(0, -1));
 
  const getTerminalPos = (terminalId) => {
    const el     = terminalRefs.current?.[terminalId];
    const canvas = canvasRef.current;
    if (!el || !canvas) return null;
    const tR = el.getBoundingClientRect();
    const cR = canvas.getBoundingClientRect();
    return {
      x: tR.left - cR.left + tR.width  / 2,
      y: tR.top  - cR.top  + tR.height / 2,
    };
  };
 
  // ── Terminal click: start OR finish ──────────────────────────────────────
  const handleTerminalClick = useCallback(({ terminalId }) => {
    if (!wireModeRef.current) return;
    const pos     = getTerminalPos(terminalId);
    if (!pos) return;
    const current = activeWireRef.current;
 
    if (!current) {
      syncActiveWire({
        startTerminal: terminalId,
        startPos:      pos,
        segments:      [pos],
        previewEnd:    pos,
        lastDir:       null,
      });
      return;
    }
 
    if (terminalId === current.startTerminal) return;
 
    const last = current.segments[current.segments.length - 1];
    const snap = getOrthogonalSnap(last, pos, current.lastDir);
    const mids = current.segments.slice(1);
    if (snap.x !== last.x || snap.y !== last.y) mids.push(snap);
 
    setWires((ws) => [
      ...ws,
      {
        id:         "w-" + Date.now(),
        from:       current.startTerminal,
        to:         terminalId,
        points:     [current.startPos, ...mids, pos],
        midPoints:  mids,
        lastMidDir: current.lastDir,
      },
    ]);
    syncActiveWire(null);
  }, []);
 
  useEffect(() => {
    window.handleTerminalClick = handleTerminalClick;
  }, [handleTerminalClick]);
 
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") syncActiveWire(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
 
  // ── mousedown on canvas: start segment drag OR ignore ────────────────────
  const onMouseDown = useCallback((e) => {
    // Only drag when wire mode is ON and no wire is currently being drawn
    if (!wireModeRef.current) return;
    if (activeWireRef.current) return;
    if (e.target.classList.contains("terminal")) return;
 
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cR = canvas.getBoundingClientRect();
    const cx = e.clientX - cR.left;
    const cy = e.clientY - cR.top;
 
    // Hit-test every finished wire's segments
    for (const wire of wiresRef.current) {
      const { segments } = resolveWirePoints(wire, terminalRefs, canvas);
      const hit = hitTestWire(segments, cx, cy);
      if (!hit) continue;
 
      e.preventDefault();
      e.stopPropagation();
 
      // Figure out which midPoints this segment sits between so we know
      // what to update when the user drags.
      // pts layout: [start, ...mids, snapPt?, end]
      // segment index `hit.i` maps to the gap between pts[hit.i] and pts[hit.i+1]
      // The midPoints array is pts[1..pts.length-2] minus the auto-computed
      // final snap. We'll recompute midPoints from scratch after drag.
      syncDragState({
        wireId:       wire.id,
        segIndex:     hit.i,        // which segment in the resolved pts array
        axis:         hit.isH ? "h" : "v",
        startMouseX:  cx,
        startMouseY:  cy,
        // snapshot the wire's midPoints at drag start
        origMidPoints: wire.midPoints.map((p) => ({ ...p })),
        origPoints:    wire.points.map((p) => ({ ...p })),
        origLastMidDir: wire.lastMidDir,
      });
      return;
    }
  }, []);
 
  // Keep a ref to wires so onMouseDown (stable callback) can read latest value
  const wiresRef = useRef([]);
  wiresRef.current = wires;
 
  // ── mousemove: update preview OR drag segment ─────────────────────────────
  const onMouseMove = useCallback((e) => {
    const cR = canvasRef.current?.getBoundingClientRect();
    if (!cR) return;
    const cx = e.clientX - cR.left;
    const cy = e.clientY - cR.top;
 
    // Segment drag
    const drag = dragStateRef.current;
    if (drag) {
      const deltaX = cx - drag.startMouseX;
      const deltaY = cy - drag.startMouseY;
 
      setWires((ws) => ws.map((w) => {
        if (w.id !== drag.wireId) return w;
 
        // We need to move the segment at drag.segIndex perpendicular to its axis.
        // Strategy: rebuild midPoints by moving the relevant corner points.
        //
        // Resolved pts: [start, ...mids, (finalSnap)?, end]
        // Segment i sits between pts[i] and pts[i+1].
        // - If segment is HORIZONTAL (isH), dragging moves it vertically (delta Y).
        //   The endpoints of this segment are pts[i] and pts[i+1].
        //   pts[i] connects to pts[i-1] vertically, pts[i+1] connects to pts[i+2] vertically.
        //   So we shift Y of pts[i] AND pts[i+1] by deltaY.
        // - If segment is VERTICAL, shift X of pts[i] AND pts[i+1] by deltaX.
        //
        // Then we re-derive midPoints from the new pts (excluding start and end terminals).
 
        const canvas = canvasRef.current;
        if (!canvas) return w;
        const { pts: origPts } = resolveWirePoints(
          { ...w, midPoints: drag.origMidPoints, points: drag.origPoints, lastMidDir: drag.origLastMidDir },
          terminalRefs, canvas
        );
 
        // Clone pts, shift the two endpoints of the dragged segment
        const newPts = origPts.map((p) => ({ ...p }));
        if (drag.axis === "h") {
          newPts[drag.segIndex].y     += deltaY;
          newPts[drag.segIndex + 1].y += deltaY;
        } else {
          newPts[drag.segIndex].x     += deltaX;
          newPts[drag.segIndex + 1].x += deltaX;
        }
 
        // Derive new midPoints: everything between index 1 and length-2
        // (i.e. exclude the terminal start and end points)
        const newMids = newPts.slice(1, newPts.length - 1);
 
        // Determine lastMidDir from the direction of the last mid→end segment
        const lastMid = newMids.length > 0 ? newMids[newMids.length - 1] : newPts[0];
        const endPt   = newPts[newPts.length - 1];
        const ldx = Math.abs(endPt.x - lastMid.x);
        const ldy = Math.abs(endPt.y - lastMid.y);
        const newLastMidDir = ldx >= ldy ? "h" : "v";
 
        return {
          ...w,
          points:     [newPts[0], ...newMids, endPt],
          midPoints:  newMids,
          lastMidDir: newLastMidDir,
        };
      }));
      return;
    }
 
    // Wire preview
    if (activeWireRef.current) {
      syncActiveWireRef.current({ ...activeWireRef.current, previewEnd: { x: cx, y: cy } });
    }
  }, []);
 
  // ── mouseup: end segment drag ─────────────────────────────────────────────
  const onMouseUp = useCallback(() => {
    if (dragStateRef.current) syncDragState(null);
  }, []);
 
  // ── left-click on canvas: bend OR ignore (if dragging just ended) ─────────
  const onClick = useCallback((e) => {
    const prev = activeWireRef.current;
    if (!prev) return;
    if (e.target.classList.contains("terminal")) return;
 
    const cR = canvasRef.current?.getBoundingClientRect();
    if (!cR) return;
    const cursor = { x: e.clientX - cR.left, y: e.clientY - cR.top };
    const last   = prev.segments[prev.segments.length - 1];
    const snap   = getOrthogonalSnap(last, cursor, prev.lastDir);
 
    const segDx   = Math.abs(snap.x - last.x);
    const segDy   = Math.abs(snap.y - last.y);
    const segDir  = segDx >= segDy ? "h" : "v";
    const nextDir = segDir === "h" ? "v" : "h";
 
    syncActiveWireRef.current({
      ...prev,
      segments:   [...prev.segments, snap],
      lastDir:    nextDir,
      previewEnd: cursor,
    });
  }, []);
 
  const onContextMenu = useCallback((e) => {
    if (activeWireRef.current) e.preventDefault();
  }, []);
 
  return {
    wires,
    activeWire,
    wireMode,
    layoutTick,
    dragState,
    setWireMode,
    undoWire,
    cancelWire:  () => syncActiveWire(null),
    clearWires:  () => { setWires([]); syncActiveWire(null); },
    canvasProps: { onMouseDown, onMouseMove, onMouseUp, onContextMenu, onClick },
  };
}
 
// ─── Legacy straight Wire ─────────────────────────────────────────────────────
function Wire({ start, end }) {
  if (!start || !end) return null;
  const dx  = Math.abs(end.x - start.x);
  const dy  = Math.abs(end.y - start.y);
  const mid = dx > dy ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
  return (
    <svg style={{ position:"absolute", left:0, top:0, width:"100%", height:"100%", pointerEvents:"none" }}>
      <line x1={start.x} y1={start.y} x2={mid.x} y2={mid.y} stroke="#1a1a1a" strokeWidth="2" />
      <line x1={mid.x}   y1={mid.y}   x2={end.x} y2={end.y} stroke="#1a1a1a" strokeWidth="2" />
    </svg>
  );
}
 
export default Wire;
 