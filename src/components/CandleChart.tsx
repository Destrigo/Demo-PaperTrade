import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTranslation } from 'react-i18next';
import type { PricePoint } from '../types/types';
import { currentLocale, formatDate, formatPrice } from '../utils/format';

const UP = '#3dffb0';
const DOWN = '#ff5c7a';
const GRID = '#12302a';

interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

function toCandles(data: PricePoint[]) {
  const candles: Candle[] = [];
  const volumes: Array<{ time: UTCTimestamp; value: number; color: string }> = [];
  data.forEach((p, i) => {
    const open = p.open ?? data[i - 1]?.value ?? p.value;
    const close = p.value;
    const high = Math.max(p.high ?? close, open, close);
    const low = Math.min(p.low ?? close, open, close);
    const time = p.time as UTCTimestamp;
    candles.push({ time, open, high, low, close });
    volumes.push({ time, value: p.volume ?? 0, color: close >= open ? 'rgba(61,255,176,0.35)' : 'rgba(255,92,122,0.35)' });
  });
  return { candles, volumes };
}

interface CandleChartProps {
  data: PricePoint[];
  /** Live price: moves the last candle's close, like a real chart. */
  livePrice?: number;
  emptyMessage?: string;
}

export default function CandleChart({ data, livePrice, emptyMessage }: CandleChartProps) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lastRef = useRef<Candle | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: '#a8cfc3',
        fontFamily: "'IBM Plex Mono', monospace",
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { vertLine: { color: '#1f4d40' }, horzLine: { color: '#1f4d40' } },
      localization: {
        locale: currentLocale(),
        priceFormatter: (price: number) => formatPrice(price),
        timeFormatter: (time: Time) => formatDate(Number(time) * 1000),
      },
      rightPriceScale: { borderColor: GRID, scaleMargins: { top: 0.08, bottom: 0.25 } },
      timeScale: { borderColor: GRID, timeVisible: false },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: 'custom', formatter: (v: number) => Intl.NumberFormat(currentLocale(), { notation: 'compact' }).format(v) }, priceScaleId: '' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const { candles, volumes } = toCandles(data);
    candleSeries.setData(candles);
    volumeSeries.setData(volumes);
    candleRef.current = candleSeries;
    lastRef.current = candles[candles.length - 1] ?? null;

    requestAnimationFrame(() => chart.timeScale().fitContent());

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
    };
    // Re-created on language change so axis labels follow the active locale.
  }, [data, i18n.resolvedLanguage]);

  useEffect(() => {
    const last = lastRef.current;
    if (!candleRef.current || !last || !livePrice || livePrice === last.close) return;
    const next = { ...last, close: livePrice, high: Math.max(last.high, livePrice), low: Math.min(last.low, livePrice) };
    lastRef.current = next;
    candleRef.current.update(next);
  }, [livePrice]);

  if (data.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center text-sm text-muted-foreground">
        {emptyMessage ?? t('assetDetails.historyUnavailable')}
      </div>
    );
  }

  return <div ref={containerRef} className="h-72 w-full pt-2" />;
}
