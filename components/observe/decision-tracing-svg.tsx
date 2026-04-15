interface Props {
  checks: { name: string; verdict: "pass" | "fail" | "warning" }[];
  outputStatus: "Ready" | "Blocked";
}

const verdictColor = (verdict: "pass" | "fail" | "warning") => {
  switch (verdict) {
    case "pass":
      return "#10b981";
    case "warning":
      return "#f59e0b";
    case "fail":
      return "#ef4444";
  }
};

export function DecisionTracingSvg({ checks, outputStatus }: Props) {
  const checkRadius = 30;
  const agentRadius = 40;
  const outputRadius = 35;
  const columnGap = 220;
  const rowHeight = 70;

  // Layout: agent at top-left, checks stacked in middle, output on right
  const agentX = 60;
  const agentY = 150;

  const checksStartY = 80;
  const middleX = agentX + columnGap;

  const outputX = middleX + columnGap;
  const outputY = agentY;

  return (
    <svg viewBox="0 0 800 300" className="w-full h-auto">
      {/* Agent Decision circle (left) */}
      <circle
        cx={agentX}
        cy={agentY}
        r={agentRadius}
        fill="currentColor"
        className="text-blue-600"
      />
      <text
        x={agentX}
        y={agentY + 5}
        textAnchor="middle"
        className="text-xs font-semibold fill-white"
      >
        Agent
      </text>
      <text
        x={agentX}
        y={agentY + 18}
        textAnchor="middle"
        className="text-xs font-semibold fill-white"
      >
        Decision
      </text>

      {/* Compliance check circles (middle column) */}
      {checks.map((check, idx) => {
        const y = checksStartY + idx * rowHeight;
        const color = verdictColor(check.verdict);

        return (
          <g key={check.name}>
            {/* Bezier curve from agent to check */}
            <path
              d={`M ${agentX + agentRadius} ${agentY} C ${(agentX + middleX) / 2} ${agentY}, ${(agentX + middleX) / 2} ${y}, ${middleX - checkRadius} ${y}`}
              stroke="#d1d5db"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4,4"
            />

            {/* Check circle */}
            <circle cx={middleX} cy={y} r={checkRadius} fill={color} />
            <text
              x={middleX}
              y={y + 5}
              textAnchor="middle"
              className="text-xs font-bold fill-white"
            >
              {check.verdict === "pass" ? "✓" : check.verdict === "warning" ? "!" : "✕"}
            </text>

            {/* Check label to the right */}
            <text
              x={middleX + checkRadius + 12}
              y={y + 5}
              className="text-xs font-medium fill-gray-700"
            >
              {check.name}
            </text>
          </g>
        );
      })}

      {/* Output circle (right) */}
      {checks.map((check, idx) => {
        const y = checksStartY + idx * rowHeight;
        const isBlocked =
          outputStatus === "Blocked" ||
          checks.some((c) => c.verdict === "fail" || c.verdict === "warning");

        return (
          <path
            key={`output-line-${idx}`}
            d={`M ${middleX + checkRadius} ${y} C ${(middleX + outputX) / 2} ${y}, ${(middleX + outputX) / 2} ${outputY}, ${outputX - outputRadius} ${outputY}`}
            stroke="#d1d5db"
            strokeWidth="2"
            fill="none"
            strokeDasharray="4,4"
          />
        );
      })}

      <circle
        cx={outputX}
        cy={outputY}
        r={outputRadius}
        fill={outputStatus === "Ready" ? "#10b981" : "#ef4444"}
      />
      <text
        x={outputX}
        y={outputY - 5}
        textAnchor="middle"
        className="text-xs font-bold fill-white"
      >
        {outputStatus === "Ready" ? "✓" : "✕"}
      </text>
      <text
        x={outputX}
        y={outputY + 10}
        textAnchor="middle"
        className="text-xs font-semibold fill-white"
      >
        {outputStatus}
      </text>
    </svg>
  );
}
