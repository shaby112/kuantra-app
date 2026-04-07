import { Icon } from "@/components/Icon";
import { EChart } from "@/components/dashboard/EChart";

const mint = "#5AF0B3";
const purple = "#8B5CF6";

const monthlyMRR = [
  { month: "Oct", value: 42000 },
  { month: "Nov", value: 46100 },
  { month: "Dec", value: 49800 },
  { month: "Jan", value: 53900 },
  { month: "Feb", value: 57700 },
  { month: "Mar", value: 62300 },
];

const regionBreakdown = [
  { region: "North America", value: 28500 },
  { region: "Europe", value: 18200 },
  { region: "APAC", value: 11400 },
  { region: "LATAM", value: 4200 },
];

const sampleSql = `SELECT
  DATE_TRUNC('month', invoice_date) AS month,
  region,
  SUM(mrr_value) AS mrr_value
FROM subscriptions
WHERE invoice_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY 1, 2
ORDER BY 1, 2;`;

export function DashboardSplitView() {
  return (
    <div className="relative z-10 grid h-full min-h-[560px] grid-cols-1 gap-4 p-4 lg:grid-cols-2">
      {/* SQL Editor Card */}
      <div className="bg-obsidian-surface-lowest rounded-lg border border-obsidian-outline-variant/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-obsidian-outline-variant/10">
          <div className="flex items-center gap-2">
            <Icon name="terminal" size="sm" className="text-obsidian-on-surface-variant" />
            <span className="font-label text-xs text-obsidian-on-surface-variant">DuckDB SQL Editor</span>
          </div>
          <span className="px-2 py-0.5 bg-obsidian-primary/10 text-obsidian-primary text-[9px] font-label font-bold uppercase tracking-wider rounded border border-obsidian-primary/20">
            LIVE QUERY
          </span>
        </div>
        <div className="h-[calc(100%-48px)] p-0">
          <pre className="h-full overflow-auto p-5 font-mono text-xs leading-6 text-obsidian-primary/80 whitespace-pre-wrap">{sampleSql}</pre>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-rows-2 gap-4">
        <div className="bg-obsidian-surface-low rounded-lg border border-obsidian-outline-variant/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-obsidian-outline-variant/10">
            <h3 className="text-sm font-bold text-obsidian-on-surface">MRR Growth (6 Months)</h3>
          </div>
          <div className="h-[240px] p-4">
            <EChart
              option={{
                xAxis: {
                  type: "category",
                  data: monthlyMRR.map((d) => d.month),
                  axisLine: { lineStyle: { color: "#3C4A42" } },
                  axisLabel: { color: "#85948B", fontFamily: "Space Grotesk", fontSize: 10 },
                },
                yAxis: {
                  type: "value",
                  splitLine: { lineStyle: { color: "#3C4A42", opacity: 0.3 } },
                  axisLabel: { color: "#85948B", fontFamily: "Space Grotesk", fontSize: 10 },
                },
                grid: { top: 10, right: 16, bottom: 24, left: 48 },
                series: [
                  {
                    type: "line",
                    data: monthlyMRR.map((d) => d.value),
                    smooth: true,
                    lineStyle: { color: mint, width: 3 },
                    itemStyle: { color: mint },
                    areaStyle: { color: "rgba(90,240,179,0.08)" },
                  },
                ],
              }}
              height="100%"
            />
          </div>
        </div>

        <div className="bg-obsidian-surface-low rounded-lg border border-obsidian-outline-variant/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-obsidian-outline-variant/10">
            <h3 className="text-sm font-bold text-obsidian-on-surface">Revenue by Region</h3>
          </div>
          <div className="h-[240px] p-4">
            <EChart
              option={{
                xAxis: {
                  type: "category",
                  data: regionBreakdown.map((d) => d.region),
                  axisLine: { lineStyle: { color: "#3C4A42" } },
                  axisLabel: { color: "#85948B", fontFamily: "Space Grotesk", fontSize: 10 },
                },
                yAxis: {
                  type: "value",
                  splitLine: { lineStyle: { color: "#3C4A42", opacity: 0.3 } },
                  axisLabel: { color: "#85948B", fontFamily: "Space Grotesk", fontSize: 10 },
                },
                grid: { top: 10, right: 16, bottom: 24, left: 48 },
                series: [
                  {
                    type: "bar",
                    data: regionBreakdown.map((d) => d.value),
                    itemStyle: { color: purple, borderRadius: [4, 4, 0, 0] },
                  },
                ],
              }}
              height="100%"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
