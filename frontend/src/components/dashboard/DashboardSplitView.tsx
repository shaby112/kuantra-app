import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EChart } from "@/components/dashboard/EChart";

const mint = "#00E599";

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
      <Card className="border-white/10 bg-[#0B0B0B] text-zinc-100 shadow-2xl">
        <CardHeader className="border-b border-white/10 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-sm text-zinc-200">DuckDB SQL Editor</CardTitle>
            <Badge className="border-emerald-400/30 bg-emerald-500/10 font-mono text-[10px] text-emerald-300">LIVE QUERY</Badge>
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-72px)] p-0">
          <pre className="h-full overflow-auto p-4 font-mono text-xs leading-6 text-zinc-300">{sampleSql}</pre>
        </CardContent>
      </Card>

      <div className="grid grid-rows-2 gap-4">
        <Card className="border-white/10 bg-[#0F1115] shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-100">MRR Growth (6 Months)</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <EChart
              option={{
                xAxis: { type: "category", data: monthlyMRR.map((d) => d.month) },
                yAxis: { type: "value" },
                series: [
                  {
                    type: "line",
                    data: monthlyMRR.map((d) => d.value),
                    smooth: true,
                    lineStyle: { color: mint, width: 3 },
                    itemStyle: { color: mint },
                    areaStyle: { color: "rgba(0,229,153,0.12)" },
                  },
                ],
              }}
              height="100%"
            />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0F1115] shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-100">Revenue by Region</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <EChart
              option={{
                xAxis: { type: "category", data: regionBreakdown.map((d) => d.region) },
                yAxis: { type: "value" },
                series: [
                  {
                    type: "bar",
                    data: regionBreakdown.map((d) => d.value),
                    itemStyle: { color: mint, borderRadius: [6, 6, 0, 0] },
                  },
                ],
              }}
              height="100%"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
