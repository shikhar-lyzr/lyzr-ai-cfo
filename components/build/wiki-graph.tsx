"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface WikiNode extends d3.SimulationNodeDatum {
  id: string;
  type: "entity" | "concept" | "synthesis";
  label: string;
}

interface WikiLink extends d3.SimulationLinkDatum<WikiNode> {
  source: string | WikiNode;
  target: string | WikiNode;
}

interface WikiGraphProps {
  onNodeClick?: (node: WikiNode) => void;
}

const NODES: WikiNode[] = [
  // Entities (teal)
  { id: "gl-account-structure", type: "entity", label: "GL Account Structure", x: 100, y: 100 },
  { id: "vendor-registry", type: "entity", label: "Vendor Registry", x: 150, y: 150 },
  { id: "entity-list", type: "entity", label: "Entity List", x: 200, y: 100 },
  { id: "bank-accounts", type: "entity", label: "Bank Accounts", x: 180, y: 200 },

  // Concepts (blue)
  { id: "close-process", type: "concept", label: "Close Process", x: 350, y: 80 },
  { id: "reconciliation", type: "concept", label: "Reconciliation Methodology", x: 400, y: 140 },
  { id: "variance-thresholds", type: "concept", label: "Variance Thresholds", x: 380, y: 200 },
  { id: "ifrs9-staging", type: "concept", label: "IFRS 9 Staging", x: 450, y: 160 },
  { id: "basel-rules", type: "concept", label: "Basel III Rules", x: 420, y: 240 },
  { id: "lcr-calculation", type: "concept", label: "LCR Calculation", x: 500, y: 200 },

  // Synthesis (purple)
  { id: "q1-variance", type: "synthesis", label: "Q1 Variance Summary", x: 650, y: 100 },
  { id: "ar-aging", type: "synthesis", label: "AR Aging Analysis", x: 700, y: 160 },
  { id: "capital-adequacy", type: "synthesis", label: "Capital Adequacy Review", x: 680, y: 240 },
];

const LINKS: WikiLink[] = [
  // Synthesis to Entities
  { source: "q1-variance", target: "gl-account-structure" },
  { source: "q1-variance", target: "bank-accounts" },
  { source: "ar-aging", target: "entity-list" },
  { source: "ar-aging", target: "vendor-registry" },
  { source: "capital-adequacy", target: "bank-accounts" },
  { source: "capital-adequacy", target: "gl-account-structure" },

  // Synthesis to Concepts
  { source: "q1-variance", target: "variance-thresholds" },
  { source: "q1-variance", target: "reconciliation" },
  { source: "ar-aging", target: "reconciliation" },
  { source: "capital-adequacy", target: "basel-rules" },
  { source: "capital-adequacy", target: "lcr-calculation" },

  // Concept to Concept
  { source: "close-process", target: "reconciliation" },
  { source: "reconciliation", target: "variance-thresholds" },
  { source: "variance-thresholds", target: "ifrs9-staging" },
  { source: "ifrs9-staging", target: "basel-rules" },
  { source: "basel-rules", target: "lcr-calculation" },
  { source: "close-process", target: "ifrs9-staging" },

  // Concept to Entity
  { source: "reconciliation", target: "vendor-registry" },
  { source: "reconciliation", target: "bank-accounts" },
  { source: "close-process", target: "gl-account-structure" },
  { source: "ifrs9-staging", target: "bank-accounts" },
  { source: "basel-rules", target: "entity-list" },

  // Additional connections for density
  { source: "close-process", target: "vendor-registry" },
  { source: "variance-thresholds", target: "entity-list" },
  { source: "ifrs9-staging", target: "vendor-registry" },
  { source: "lcr-calculation", target: "entity-list" },
  { source: "q1-variance", target: "close-process" },
  { source: "ar-aging", target: "close-process" },
  { source: "capital-adequacy", target: "close-process" },
  { source: "q1-variance", target: "ifrs9-staging" },
  { source: "ar-aging", target: "variance-thresholds" },
  { source: "capital-adequacy", target: "ifrs9-staging" },
  { source: "reconciliation", target: "entity-list" },
  { source: "close-process", target: "lcr-calculation" },
];

export function WikiGraph({ onNodeClick }: WikiGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 500;

    const svg = d3.select(svgRef.current).attr("viewBox", [0, 0, width, height]);

    // Clear previous content
    svg.selectAll("*").remove();

    // Create force simulation
    const simulation = d3
      .forceSimulation<WikiNode>(NODES)
      .force("link", d3.forceLink<WikiNode, WikiLink>(LINKS).id((d) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<WikiNode>().radius((d) => (d.type === "synthesis" ? 35 : d.type === "concept" ? 28 : 25)))
      .alpha(0.3)
      .alphaDecay(0.02);

    // Container for zoom
    const g = svg.append("g");

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(LINKS)
      .join("line")
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    // Draw nodes
    const node = g
      .append("g")
      .selectAll("circle")
      .data(NODES)
      .join("circle")
      .attr("r", (d) => (d.type === "synthesis" ? 32 : d.type === "concept" ? 24 : 20))
      .attr("fill", (d) => {
        if (d.type === "entity") return "#14b8a6";
        if (d.type === "concept") return "#3b82f6";
        return "#a855f7";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .call(d3.drag<SVGCircleElement, WikiNode>().on("start", dragStarted).on("drag", dragged).on("end", dragEnded) as any)
      .on("click", (_event, d) => {
        if (onNodeClick) {
          onNodeClick(d);
        }
      });

    // Draw labels
    const labels = g
      .append("g")
      .selectAll("text")
      .data(NODES)
      .join("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", "#1f2937")
      .attr("pointer-events", "none")
      .text((d) => d.label);

    // Simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as WikiNode).x || 0)
        .attr("y1", (d) => (d.source as WikiNode).y || 0)
        .attr("x2", (d) => (d.target as WikiNode).x || 0)
        .attr("y2", (d) => (d.target as WikiNode).y || 0);

      node.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0);

      labels.attr("x", (d) => d.x || 0).attr("y", (d) => d.y || 0);
    });

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    svg.call(zoom);

    // Drag handlers
    function dragStarted(event: d3.D3DragEvent<SVGCircleElement, WikiNode, WikiNode>, d: WikiNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, WikiNode, WikiNode>, d: WikiNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event: d3.D3DragEvent<SVGCircleElement, WikiNode, WikiNode>, d: WikiNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [onNodeClick]);

  return (
    <svg
      ref={svgRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "500px",
        border: "1px solid #e5e7eb",
        borderRadius: "var(--radius)",
        backgroundColor: "#fafafa",
      }}
    />
  );
}
