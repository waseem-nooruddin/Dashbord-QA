import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent, TitleComponent, TooltipComponent } from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, PieChart, GridComponent, LegendComponent, MarkLineComponent, TitleComponent, TooltipComponent, LabelLayout, CanvasRenderer]);

interface Props {
  option: echarts.EChartsCoreOption;
  height: number;
  label: string;
  /** Called with the module name when a bar, slice or axis label is clicked. */
  onSelect?: (name: string) => void;
}

export function EChart({ option, height, label, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    const c = echarts.init(el.current!);
    chart.current = c;
    c.on("click", (p: { componentType?: string; name?: string; value?: unknown }) => {
      const name = p.componentType === "yAxis" ? String(p.value) : p.name;
      if (name && name !== "Other modules" && name !== "Defects") select.current?.(name);
    });
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); c.dispose(); };
  }, []);

  useEffect(() => { chart.current?.setOption(option, true); }, [option]);
  useEffect(() => { chart.current?.resize(); }, [height]);

  return <div ref={el} role="img" aria-label={label} style={{ width: "100%", height }} />;
}
