import ReactECharts from "echarts-for-react";
import { useTheme } from "next-themes";
import type { EChartsOption } from "echarts";
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  RadarChart,
  TreemapChart,
  SankeyChart,
  GaugeChart,
  SunburstChart,
  GraphChart,
  BoxplotChart,
  CandlestickChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  DatasetComponent,
  TransformComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  RadarChart,
  TreemapChart,
  SankeyChart,
  GaugeChart,
  SunburstChart,
  GraphChart,
  BoxplotChart,
  CandlestickChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  DatasetComponent,
  TransformComponent,
  CanvasRenderer,
]);

interface EChartProps {
  option: EChartsOption;
  className?: string;
  height?: string | number;
}

export function EChart({ option, className, height = "100%" }: EChartProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const baseOption: EChartsOption = {
    backgroundColor: "transparent",
    textStyle: {
      color: dark ? "#e5e7eb" : "#374151",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: dark ? "#111827" : "#ffffff",
      borderColor: dark ? "#374151" : "#e5e7eb",
      textStyle: {
        color: dark ? "#e5e7eb" : "#374151",
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "10%",
      containLabel: true,
    },
    animation: true,
    animationDuration: 600,
    animationEasing: "cubicOut",
    ...option,
  };

  return (
    <ReactECharts
      option={baseOption}
      className={className}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  );
}
