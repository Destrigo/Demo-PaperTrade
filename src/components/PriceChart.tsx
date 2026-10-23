import { useEffect, useRef } from 'react';
import { createChart, LineSeries, TickMarkType, type IChartApi, type Time, type UTCTimestamp } from 'lightweight-charts';
import type { PricePoint } from '../types/types';
import { useTranslation } from 'react-i18next';
import { currentLocale, formatDate, formatDateTime, formatPrice } from '../utils/format';

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface PriceChartProps {
  data: PricePoint[];
  emptyMessage?: string;
}

export default function PriceChart({ data, emptyMessage }: PriceChartProps) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
  
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: `hsl(${cssVar('--muted-foreground')})`,
        fontFamily: "'IBM Plex Mono', monospace",
      },
      grid: {
        vertLines: { color: `hsl(${cssVar('--border')})` },
        horzLines: { color: `hsl(${cssVar('--border')})` },
      },
      localization: {
        locale: currentLocale(),
        priceFormatter: (price: number) => formatPrice(price),
        timeFormatter: (time: Time) => formatDateTime(Number(time) * 1000),
      },
      // Keep the top/bottom price labels inside the plot instead of clipped at the edge.
      rightPriceScale: { scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: {
        timeVisible: true,
        minBarSpacing: 0.1,
        tickMarkFormatter: (time: Time, type: TickMarkType) => {
          const ms = Number(time) * 1000;
          switch (type) {
            case TickMarkType.Year:
              return formatDate(ms, { year: 'numeric' });
            case TickMarkType.Month:
              return formatDate(ms, { month: 'short' });
            case TickMarkType.DayOfMonth:
              return formatDate(ms, { day: 'numeric', month: 'short' });
            default:
              return new Date(ms).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' });
          }
        },
      },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;
  
    const series = chart.addSeries(LineSeries, { color: '#3dffb0', lineWidth: 2 });
    const chartData = data.map((point) => ({ time: point.time as UTCTimestamp, value: point.value }));
    series.setData(chartData);
  
    requestAnimationFrame(() => {
      chart.timeScale().fitContent();
    });
  
    return () => {
      chart.remove();
      chartRef.current = null;
    };
    // Re-created on language change so axis labels follow the active locale.
  }, [data, i18n.resolvedLanguage]);


  if (data.length === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center text-sm text-muted-foreground">
      {emptyMessage ?? t('assetDetails.historyUnavailable')}
      </div>
    );
  }

  return <div ref={containerRef} className="h-64 w-full pt-2" />;
}
