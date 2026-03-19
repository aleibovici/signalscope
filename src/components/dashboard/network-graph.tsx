"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { stageLabel } from "@/lib/stage-labels";
import type { NetworkNode, NetworkEdge } from "@/hooks/use-network";

export type ColorMode = "stage" | "sector";

interface NetworkGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  centerSymbol: string | null;
  colorMode?: ColorMode;
  onNodeClick?: (symbol: string) => void;
}

interface SimNode extends NetworkNode {
  x: number;
  y: number;
}

const STAGE_COLORS: Record<string, string> = {
  Emerging: "#22c55e",
  Building: "#f59e0b",
  Consensus: "#3b82f6",
};

const SECTOR_COLORS: Record<string, string> = {
  Technology: "#3b82f6",
  Healthcare: "#ef4444",
  "Financial Services": "#10b981",
  Energy: "#f59e0b",
  "Consumer Cyclical": "#8b5cf6",
  "Consumer Defensive": "#06b6d4",
  Industrials: "#6b7280",
  "Basic Materials": "#d97706",
  "Communication Services": "#ec4899",
  "Real Estate": "#14b8a6",
  Utilities: "#84cc16",
};

function getNodeColor(node: NetworkNode, mode: ColorMode): string {
  if (mode === "sector") {
    return SECTOR_COLORS[node.sector ?? ""] ?? "#9ca3af";
  }
  return STAGE_COLORS[node.stage] ?? "#6b7280";
}

function getNodeRadius(aiScore: number): number {
  return 8 + (aiScore / 100) * 16;
}

function runSimulation(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  width: number,
  height: number,
  centerSymbol: string | null,
): SimNode[] {
  if (nodes.length === 0) return [];

  const cx = width / 2;
  const cy = height / 2;

  const simulated = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const r = Math.min(width, height) * 0.35;
    return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 };
  });

  if (centerSymbol) {
    const ci = simulated.findIndex((n) => n.symbol === centerSymbol);
    if (ci >= 0) { simulated[ci].x = cx; simulated[ci].y = cy; }
  }

  const nodeMap = new Map(simulated.map((n) => [n.symbol, n]));
  const damping = 0.9;

  for (let iter = 0; iter < 300; iter++) {
    for (let i = 0; i < simulated.length; i++) {
      for (let j = i + 1; j < simulated.length; j++) {
        const a = simulated[i], b = simulated[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = 2000 / (dist * dist);
        dx = (dx / dist) * f; dy = (dy / dist) * f;
        a.vx -= dx; a.vy -= dy; b.vx += dx; b.vy += dy;
      }
    }
    for (const edge of edges) {
      const a = nodeMap.get(edge.source), b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (dist - 80) * 0.01 * edge.weight;
      dx = (dx / dist) * f; dy = (dy / dist) * f;
      a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
    }
    for (const node of simulated) {
      node.vx += (cx - node.x) * 0.005;
      node.vy += (cy - node.y) * 0.005;
      node.vx *= damping; node.vy *= damping;
      node.x += node.vx; node.y += node.vy;
      const r = getNodeRadius(node.aiScore);
      node.x = Math.max(r, Math.min(width - r, node.x));
      node.y = Math.max(r, Math.min(height - r, node.y));
    }
  }
  return simulated;
}

export function NetworkGraph({ nodes, edges, centerSymbol, colorMode = "stage", onNodeClick }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragPos, setDragPos] = useState<{ symbol: string; x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<NetworkEdge | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const [edgeTooltip, setEdgeTooltip] = useState<{ x: number; y: number; edge: NetworkEdge } | null>(null);
  const dragRef = useRef<string | null>(null);

  // Zoom & pan state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 600, h: 400 });
  const panRef = useRef<{ startX: number; startY: number; vbX: number; vbY: number } | null>(null);

  // Build neighbor set for hover isolation
  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    }
    return map;
  }, [edges]);

  // ResizeObserver — also resets viewBox
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = entry.contentRect.width;
        const h = Math.max(300, entry.contentRect.height);
        setDimensions({ width: w, height: h });
        setViewBox({ x: 0, y: 0, w, h });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const baseNodes = useMemo(
    () => runSimulation(nodes, edges, dimensions.width, dimensions.height, centerSymbol),
    [nodes, edges, dimensions, centerSymbol],
  );

  const simNodes = useMemo(() => {
    if (!dragPos) return baseNodes;
    return baseNodes.map((n) =>
      n.symbol === dragPos.symbol ? { ...n, x: dragPos.x, y: dragPos.y } : n,
    );
  }, [baseNodes, dragPos]);

  // Zoom via scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const svg = svgRef.current;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    setViewBox((prev) => {
      const newW = Math.max(100, Math.min(dimensions.width * 3, prev.w * scaleFactor));
      const newH = Math.max(75, Math.min(dimensions.height * 3, prev.h * scaleFactor));
      const ratio = newW / prev.w;
      const newX = svgPt.x - (svgPt.x - prev.x) * ratio;
      const newY = svgPt.y - (svgPt.y - prev.y) * ratio;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, [dimensions]);

  // Pan via background drag
  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) return; // node drag takes priority
    if ((e.target as Element).tagName !== "svg" && !(e.target as Element).classList.contains("graph-bg")) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, vbX: viewBox.x, vbY: viewBox.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [viewBox]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Node drag
    if (dragRef.current && svgRef.current) {
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      setDragPos({ symbol: dragRef.current, x: svgPt.x, y: svgPt.y });
      return;
    }
    // Pan
    if (panRef.current && svgRef.current) {
      const svg = svgRef.current;
      const ctm = svg.getScreenCTM()!;
      const scale = viewBox.w / (dimensions.width || 1);
      const dx = (e.clientX - panRef.current.startX) * scale / (ctm.a || 1) * ctm.a;
      const dy = (e.clientY - panRef.current.startY) * scale / (ctm.d || 1) * ctm.d;
      setViewBox((prev) => ({
        ...prev,
        x: panRef.current!.vbX - dx,
        y: panRef.current!.vbY - dy,
      }));
    }
  }, [viewBox.w, dimensions.width]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    panRef.current = null;
    setDragPos(null);
  }, []);

  const handleNodePointerDown = useCallback((symbol: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = symbol;
    (e.target as Element).setPointerCapture(e.pointerId);
  }, []);

  const handleNodeClick = useCallback((symbol: string) => {
    setSelectedNode((prev) => (prev === symbol ? null : symbol));
  }, []);

  const handleNodeDblClick = useCallback((symbol: string) => {
    onNodeClick?.(symbol);
  }, [onNodeClick]);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: dimensions.width, h: dimensions.height });
  }, [dimensions]);

  const nodeMap = new Map(simNodes.map((n) => [n.symbol, n]));
  const maxWeight = edges.length > 0 ? Math.max(...edges.map((e) => e.weight)) : 1;

  // Active highlight set
  const activeNode = hoveredNode || selectedNode;
  const neighbors = activeNode ? neighborMap.get(activeNode) : null;
  const isIsolating = !!activeNode;

  const selectedData = selectedNode ? nodeMap.get(selectedNode) : null;

  // Edge connection count for selected node
  const selectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter((e) => e.source === selectedNode || e.target === selectedNode)
      .sort((a, b) => b.weight - a.weight);
  }, [edges, selectedNode]);

  return (
    <div ref={containerRef} className="relative h-[500px] w-full md:h-[600px]">
      {/* Zoom controls */}
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setViewBox((v) => {
            const nw = v.w * 0.8, nh = v.h * 0.8;
            return { x: v.x + (v.w - nw) / 2, y: v.y + (v.h - nh) / 2, w: nw, h: nh };
          })}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 shadow-sm hover:bg-gray-50"
          aria-label="Zoom in"
        >+</button>
        <button
          type="button"
          onClick={() => setViewBox((v) => {
            const nw = v.w * 1.25, nh = v.h * 1.25;
            return { x: v.x - (nw - v.w) / 2, y: v.y - (nh - v.h) / 2, w: nw, h: nh };
          })}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 shadow-sm hover:bg-gray-50"
          aria-label="Zoom out"
        >&minus;</button>
        <button
          type="button"
          onClick={handleResetZoom}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-[10px] font-medium text-gray-500 shadow-sm hover:bg-gray-50"
          aria-label="Reset zoom"
        >1:1</button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handleBgPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Invisible background rect for pan events */}
        <rect
          className="graph-bg"
          x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h}
          fill="transparent"
        />

        {/* Edges */}
        {edges.map((edge) => {
          const a = nodeMap.get(edge.source);
          const b = nodeMap.get(edge.target);
          if (!a || !b) return null;
          const isConnected = activeNode
            ? edge.source === activeNode || edge.target === activeNode
            : false;
          const dimmed = isIsolating && !isConnected;
          const isEdgeHovered = hoveredEdge === edge;
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={isEdgeHovered ? "#1d4ed8" : isConnected ? "#3b82f6" : "#e5e7eb"}
              strokeWidth={1 + (edge.weight / maxWeight) * 3}
              strokeOpacity={dimmed ? 0.08 : isConnected ? 0.7 : 0.3}
              className="cursor-pointer"
              onPointerEnter={(e) => {
                setHoveredEdge(edge);
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  setEdgeTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, edge });
                }
              }}
              onPointerLeave={() => { setHoveredEdge(null); setEdgeTooltip(null); }}
            />
          );
        })}

        {/* Nodes */}
        {simNodes.map((node) => {
          const r = getNodeRadius(node.aiScore);
          const isCenter = node.symbol === centerSymbol;
          const isHovered = hoveredNode === node.symbol;
          const isSelected = selectedNode === node.symbol;
          const isNeighbor = neighbors?.has(node.symbol);
          const dimmed = isIsolating && !isHovered && !isNeighbor && node.symbol !== activeNode;
          return (
            <g
              key={node.symbol}
              opacity={dimmed ? 0.15 : 1}
              className="transition-opacity duration-150"
            >
              <circle
                cx={node.x} cy={node.y} r={r}
                fill={getNodeColor(node, colorMode)}
                fillOpacity={isHovered || isSelected ? 1 : 0.85}
                stroke={isSelected ? "#1e40af" : isCenter ? "#1e40af" : isHovered ? "#374151" : "white"}
                strokeWidth={isSelected ? 3 : isCenter ? 3 : 2}
                className="cursor-pointer"
                onPointerDown={(e) => handleNodePointerDown(node.symbol, e)}
                onPointerEnter={(e) => {
                  setHoveredNode(node.symbol);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10 });
                }}
                onPointerLeave={() => { setHoveredNode(null); setTooltip(null); }}
                onClick={(e) => { e.stopPropagation(); handleNodeClick(node.symbol); }}
                onDoubleClick={(e) => { e.stopPropagation(); handleNodeDblClick(node.symbol); }}
              />
              <text
                x={node.x} y={node.y + r + 12}
                textAnchor="middle"
                className="pointer-events-none select-none fill-gray-700 text-[10px] font-medium"
                opacity={dimmed ? 0.3 : 1}
              >
                {node.symbol}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Node hover tooltip */}
      {hoveredNode && tooltip && !selectedNode && (() => {
        const node = nodeMap.get(hoveredNode);
        if (!node) return null;
        return (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{node.symbol}</span>
              <Badge variant={node.stage === "Emerging" ? "success" : node.stage === "Building" ? "warning" : "info"}>
                {stageLabel(node.stage)}
              </Badge>
            </div>
            {node.name && <p className="text-xs text-gray-500">{node.name}</p>}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
              <span>Opp: {node.opportunityScore}</span>
              <span>Conf: {node.aiScore}</span>
              {node.price != null && <span>${node.price.toFixed(2)}</span>}
              {node.sector && <span>{node.sector}</span>}
            </div>
            <p className="mt-0.5 text-[10px] text-gray-400">Click to select &middot; Double-click to re-center</p>
          </div>
        );
      })()}

      {/* Edge hover tooltip */}
      {edgeTooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
          style={{ left: edgeTooltip.x, top: edgeTooltip.y, transform: "translate(-50%, -100%)" }}
        >
          <p className="text-sm font-semibold">
            {edgeTooltip.edge.source} &harr; {edgeTooltip.edge.target}
          </p>
          <div className="mt-0.5 flex gap-3 text-xs text-gray-600">
            <span>{edgeTooltip.edge.weight} shared scans</span>
            <span>{Math.round(edgeTooltip.edge.correlation * 100)}% correlation</span>
          </div>
        </div>
      )}

      {/* Selected node detail panel */}
      {selectedData && (
        <div className="absolute bottom-3 left-3 z-10 w-64 rounded-xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">{selectedData.symbol}</span>
                <Badge variant={selectedData.stage === "Emerging" ? "success" : selectedData.stage === "Building" ? "warning" : "info"}>
                  {stageLabel(selectedData.stage)}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" />
                </svg>
              </button>
            </div>
            {selectedData.name && <p className="mt-0.5 text-xs text-gray-500">{selectedData.name}</p>}
          </div>
          <div className="space-y-1.5 px-4 py-3 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Opportunity</span>
              <span className="font-semibold text-blue-600">{selectedData.opportunityScore}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Confidence</span>
              <span className="font-medium text-gray-800">{selectedData.aiScore}/100</span>
            </div>
            {selectedData.price != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Price</span>
                <span className="font-medium">${selectedData.price.toFixed(2)}</span>
              </div>
            )}
            {selectedData.marketCap != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Market Cap</span>
                <span className="font-medium">${(selectedData.marketCap / 1e9).toFixed(2)}B</span>
              </div>
            )}
            {selectedData.sector && (
              <div className="flex justify-between">
                <span className="text-gray-500">Sector</span>
                <span className="font-medium">{selectedData.sector}</span>
              </div>
            )}
            {selectedData.recommendation && (
              <div className="flex justify-between">
                <span className="text-gray-500">Recommendation</span>
                <span className={`font-medium ${selectedData.recommendation === "Avoid" ? "text-red-600" : "text-green-600"}`}>
                  {selectedData.recommendation}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Connections</span>
              <span className="font-medium">{selectedEdges.length}</span>
            </div>
            {selectedEdges.length > 0 && (
              <div className="mt-1">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">Top connections</p>
                <div className="space-y-0.5">
                  {selectedEdges.slice(0, 5).map((e) => {
                    const other = e.source === selectedNode ? e.target : e.source;
                    return (
                      <div key={other} className="flex items-center justify-between text-[11px]">
                        <button
                          type="button"
                          onClick={() => { setSelectedNode(other); }}
                          className="font-medium text-blue-600 hover:underline"
                        >{other}</button>
                        <span className="text-gray-400">{e.weight} scans ({Math.round(e.correlation * 100)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 px-4 py-2">
            <Link
              href={`/ticker/${selectedData.symbol}`}
              className="block text-center text-xs font-medium text-blue-600 hover:underline"
            >
              View ticker detail &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
