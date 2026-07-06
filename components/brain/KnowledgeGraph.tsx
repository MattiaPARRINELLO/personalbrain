"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { MemoryFact, MemoryRelationship } from "@/lib/types";

interface GraphNode {
  id: string;
  label: string;
  category: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface KnowledgeGraphProps {
  facts: MemoryFact[];
  relationships: MemoryRelationship[];
  onEditFact: (id: string) => void;
}

export function KnowledgeGraph({ facts, relationships, onEditFact }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const initialNodes = useMemo(() => {
    const centerX = 300;
    const centerY = 300;
    const radius = 150;
    return facts.map((f, i) => {
      const angle = (2 * Math.PI * i) / facts.length;
      return {
        id: f.id,
        label: f.content.length > 30 ? f.content.slice(0, 30) + "…" : f.content,
        category: f.category,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });
  }, [facts]);
  const [nodes, setNodes] = useState<GraphNode[]>(() => initialNodes);
  const [edges] = useState<GraphEdge[]>(() =>
    relationships.map((r) => ({ source: r.sourceId, target: r.targetId, type: r.type }))
  );
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState<{ node: GraphNode; ox: number; oy: number } | null>(null);
  const animRef = useRef<number>(0);

  // Force-directed layout simulation
  useEffect(() => {
    if (nodes.length === 0) return;
    let running = true;

    const simulate = () => {
      if (!running) return;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const repulsion = 5000;
      const attraction = 0.005;
      const damping = 0.9;
      const centerForce = 0.01;

      const newNodes = nodes.map((n) => ({ ...n }));

      for (let i = 0; i < newNodes.length; i++) {
        const a = newNodes[i];
        for (let j = i + 1; j < newNodes.length; j++) {
          const b = newNodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          a.vx += (dx / dist) * force;
          a.vy += (dy / dist) * force;
          b.vx -= (dx / dist) * force;
          b.vy -= (dy / dist) * force;
        }

        // Attraction along edges
        for (const edge of edges) {
          if (edge.source === a.id) {
            const b = nodeMap.get(edge.target);
            if (b) {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              a.vx += dx * attraction;
              a.vy += dy * attraction;
            }
          }
          if (edge.target === a.id) {
            const b = nodeMap.get(edge.source);
            if (b) {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              a.vx += dx * attraction;
              a.vy += dy * attraction;
            }
          }
        }

        // Center force
        a.vx += (300 - a.x) * centerForce;
        a.vy += (300 - a.y) * centerForce;

        // Damping
        a.vx *= damping;
        a.vy *= damping;

        // Update position
        a.x += a.vx;
        a.y += a.vy;
      }

      setNodes(newNodes);
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [nodes.length, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodeColors: Record<string, string> = {
    dev: "var(--accent)",
    photo: "var(--warm)",
    life: "var(--success)",
    preference: "var(--danger)",
  };

  const handlePointerDown = useCallback((node: GraphNode, e: React.PointerEvent) => {
    e.preventDefault();
    setDragging({ node, ox: node.x, oy: node.y });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !svgRef.current) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - transform.x) / transform.k;
    const y = (e.clientY - rect.top - transform.y) / transform.k;
    setNodes((prev) =>
      prev.map((n) => (n.id === dragging.node.id ? { ...n, x, y, vx: 0, vy: 0 } : n))
    );
  }, [dragging, transform]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({ ...t, k: Math.max(0.1, Math.min(5, t.k * delta)) }));
  }, []);

  const categoryLabels: Record<string, string> = {
    dev: "💻 Dev",
    photo: "📸 Photo",
    life: "❤️ Vie",
    preference: "⭐ Préférence",
  };

  return (
    <div className="relative w-full h-[500px] border border-[var(--border-2)] rounded-xl overflow-hidden bg-[var(--surface-1)]/40">
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {edges.map((edge, i) => {
            const source = nodes.find((n) => n.id === edge.source);
            const target = nodes.find((n) => n.id === edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="var(--border-2)"
                strokeWidth="1"
                strokeDasharray="4 2"
              />
            );
          })}
          {nodes.map((node) => (
            <g
              key={node.id}
              onPointerDown={(e) => handlePointerDown(node, e)}
              onDoubleClick={() => onEditFact(node.id)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r="20"
                fill={nodeColors[node.category] || "var(--accent)"}
                fillOpacity="0.2"
                stroke={nodeColors[node.category] || "var(--accent)"}
                strokeWidth="2"
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                fill="var(--fg)"
                fontSize="10"
                fontFamily="Geist Sans, sans-serif"
              >
                {node.label.slice(0, 15)}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <div className="absolute bottom-3 left-3 flex gap-3 text-[10px] text-[var(--muted)] font-mono">
        {Object.entries(categoryLabels).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: nodeColors[key] || "var(--accent)" }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
