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

export function DashboardSplitView() {
  return (
    <div className="relative z-10 grid h-full min-h-[560px] grid-cols-1 gap-4 p-4 lg:grid-cols-3">
      <div className="lg:col-span-2 grid grid-rows-[auto,1fr] gap-4">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "ARR", value: "$14.2M", delta: "+12.4%" },
            { label: "Net Churn", value: "1.42%", delta: "-0.13%" },
            { label: "P99 Latency", value: "124ms", delta: "-8ms" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-obsidian-outline-variant/20 bg-obsidian-surface-low/70 backdrop-blur-md p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <p className="font-label text-[10px] uppercase tracking-wider text-obsidian-on-surface-variant">{kpi.label}</p>
              <p className="mt-2 text-2xl font-bold text-obsidian-on-surface">{kpi.value}</p>
              <p className="mt-1 text-xs text-obsidian-primary">{kpi.delta}</p>
            </div>
          ))}
        </div>

        <div className="bg-obsidian-surface-low/70 rounded-xl border border-obsidian-outline-variant/20 backdrop-blur-md overflow-hidden">
          <div className="px-5 py-3 border-b border-obsidian-outline-variant/10">
            <h3 className="text-sm font-bold text-obsidian-on-surface">Revenue Dynamics</h3>
          </div>
          <div className="h-[360px] p-4">
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
                    areaStyle: { color: "rgba(90,240,179,0.14)" },
                  },
                ],
              }}
              height="100%"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-rows-2 gap-4">
        <div className="bg-obsidian-surface-low/70 rounded-xl border border-obsidian-outline-variant/20 backdrop-blur-md overflow-hidden">
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

        <div className="bg-obsidian-surface-low/70 rounded-xl border border-obsidian-outline-variant/20 backdrop-blur-md p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-obsidian-on-surface">Start Building</h3>
            <span className="px-2 py-1 rounded text-[10px] font-label tracking-wider uppercase bg-obsidian-primary/10 text-obsidian-primary border border-obsidian-primary/20">Drag + Drop</span>
          </div>
          <p className="mt-2 text-xs text-obsidian-on-surface-variant">
            Add widgets from the right library. The canvas supports drag, resize, and free movement.
          </p>
          <div className="mt-4 rounded-lg border border-obsidian-outline-variant/15 bg-obsidian-surface-lowest/70 p-3 text-xs text-obsidian-on-surface-variant">
            Tip: use the Share button to copy a live dashboard link.
          </div>
          <div className="mt-4 flex items-center gap-2 text-obsidian-primary">
            <Icon name="auto_awesome" size="sm" />
            <span className="text-xs font-label">Glass-style widgets are enabled by default.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
