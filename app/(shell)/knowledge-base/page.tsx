"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { WikiGraph, WikiNode } from "@/components/build/wiki-graph";

const SAMPLE_FILES = [
  { name: "glossary.md", type: "Reference", lastUpdated: "2026-04-10", size: "12 KB" },
  { name: "close-playbook.md", type: "Guide", lastUpdated: "2026-04-08", size: "45 KB" },
  { name: "regulatory-capital-primer.md", type: "Guide", lastUpdated: "2026-04-05", size: "67 KB" },
  { name: "ifrs9-implementation.md", type: "Reference", lastUpdated: "2026-04-01", size: "89 KB" },
  { name: "vendor-onboarding.pdf", type: "Document", lastUpdated: "2026-03-28", size: "234 KB" },
  { name: "reconciliation-matrix.xlsx", type: "Spreadsheet", lastUpdated: "2026-03-25", size: "156 KB" },
  { name: "basel-framework.md", type: "Reference", lastUpdated: "2026-03-20", size: "102 KB" },
  { name: "entity-structure.json", type: "Configuration", lastUpdated: "2026-03-15", size: "23 KB" },
];

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<"sources" | "wiki">("sources");
  const [selectedNode, setSelectedNode] = useState<WikiNode | null>(null);
  const [dataFiles, setDataFiles] = useState<string[]>([]);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch("/api/agent/context");
        const data = await res.json();
        setDataFiles(data.dataFiles || []);
      } catch (err) {
        console.error("Failed to fetch context:", err);
      }
    };
    fetchContext();
  }, []);

  const handleNodeClick = (node: WikiNode) => {
    setSelectedNode(node);
  };

  const handleClosePanel = () => {
    setSelectedNode(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <h1 className="text-[28px] font-bold text-foreground" style={{ fontFamily: "var(--font-playfair)" }}>
            Knowledge Base
          </h1>
          <SampleDataBadge />
        </div>
        <p className="text-sm text-muted-foreground">Documents the agent has read and synthesized</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab("sources")}
          className={`pb-3 font-medium text-sm transition-colors ${
            activeTab === "sources"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{
            borderBottomWidth: activeTab === "sources" ? "2px" : "0px",
            borderBottomColor: activeTab === "sources" ? "var(--primary)" : "transparent",
            marginBottom: "-1px",
          }}
        >
          Sources
        </button>
        <button
          onClick={() => setActiveTab("wiki")}
          className={`pb-3 font-medium text-sm transition-colors ${
            activeTab === "wiki"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{
            borderBottomWidth: activeTab === "wiki" ? "2px" : "0px",
            borderBottomColor: activeTab === "wiki" ? "var(--primary)" : "transparent",
            marginBottom: "-1px",
          }}
        >
          Wiki
        </button>
      </div>

      {/* Sources Tab */}
      {activeTab === "sources" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium">
              {SAMPLE_FILES.length + dataFiles.length} files
            </span>
            <button
              disabled
              title="Upload coming soon"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>+</span>
              Upload
            </button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Last Updated</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Size</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_FILES.map((file, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">{file.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{file.type}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{file.lastUpdated}</td>
                    <td className="px-4 py-3 text-muted-foreground text-right text-xs">{file.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Wiki Tab */}
      {activeTab === "wiki" && (
        <div className="space-y-4">
          {/* Stats Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700">
              15 pages / 42 links
            </span>
          </div>

          {/* Graph + Side Panel Container */}
          <div className="relative flex gap-4 h-[600px]">
            {/* Graph */}
            <div className="flex-1 border border-border rounded-lg overflow-hidden">
              <WikiGraph onNodeClick={handleNodeClick} />
            </div>

            {/* Side Panel */}
            {selectedNode && (
              <div className="w-72 bg-card border border-border rounded-lg p-4 flex flex-col space-y-4 overflow-auto">
                {/* Close Button */}
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-foreground text-base">{selectedNode.label}</h3>
                  <button
                    onClick={handleClosePanel}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Node Type Badge */}
                <div className="flex gap-2">
                  <span
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor:
                        selectedNode.type === "entity"
                          ? "#ccf7f5"
                          : selectedNode.type === "concept"
                            ? "#dbeafe"
                            : "#f3e8ff",
                      color:
                        selectedNode.type === "entity"
                          ? "#0d9488"
                          : selectedNode.type === "concept"
                            ? "#1e40af"
                            : "#7e22ce",
                    }}
                  >
                    {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
                  </span>
                </div>

                {/* Markdown Body */}
                <div className="text-sm text-muted-foreground space-y-3 border-t border-border pt-4">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Overview</h4>
                    <p className="text-xs leading-relaxed">
                      Sample wiki page for <strong>{selectedNode.label}</strong>. This node represents a{" "}
                      {selectedNode.type === "entity"
                        ? "foundational data structure"
                        : selectedNode.type === "concept"
                          ? "financial or operational methodology"
                          : "synthesized analysis"}{" "}
                      in the knowledge base.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Related Concepts</h4>
                    <p className="text-xs text-muted-foreground">
                      {selectedNode.type === "synthesis"
                        ? "This synthesis aggregates data and insights from multiple sources and methodologies."
                        : selectedNode.type === "entity"
                          ? "Foundational data structure used across close and reporting processes."
                          : "Core methodology applied to financial reconciliation and compliance."}
                    </p>
                  </div>
                </div>

                {/* Chat Input */}
                <div className="border-t border-border pt-4 space-y-2">
                  <input
                    type="text"
                    placeholder="Ask the wiki agent..."
                    disabled
                    className="w-full px-3 py-2 rounded-md border border-border bg-muted text-sm text-muted-foreground placeholder-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">Chat coming soon</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
