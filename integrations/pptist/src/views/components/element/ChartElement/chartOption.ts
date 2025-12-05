import type { ComposeOption } from 'echarts/core'
import type {
  BarSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
  ScatterSeriesOption,
  RadarSeriesOption,
} from 'echarts/charts'
import type { ChartData, ChartType } from '@/types/slides'

type EChartOption = ComposeOption<BarSeriesOption | LineSeriesOption | PieSeriesOption | ScatterSeriesOption | RadarSeriesOption>

export interface ChartOptionPayload {
  type: ChartType
  data: ChartData
  themeColors: string[]
  textColor?: string
  lineColor?: string
  lineSmooth?: boolean
  stack?: boolean
  seriesTypes?: ('bar' | 'line' | 'area')[]
  pointSizes?: number[]
  orientation?: 'vertical' | 'horizontal'
  barWidth?: number
  barCategoryGap?: string
}

const buildColoredSeriesData = (values: number[], colors?: string[], fallback?: string[]) => {
  if (!colors || colors.length === 0) return values
  return values.map((value, index) => ({
    value,
    itemStyle: {
      color: colors[index] || (fallback && fallback[index % fallback.length]) || colors[colors.length - 1],
    },
  }))
}

export const getChartOption = ({
  type,
  data,
  themeColors,
  textColor,
  lineColor,
  lineSmooth,
  stack,
  seriesTypes,
  pointSizes,
  orientation,
  barWidth,
  barCategoryGap,
}: ChartOptionPayload): EChartOption | null => {
  const textStyle = textColor ? {
    color: textColor
  } : {}

  const axisLine = textColor ? {
    lineStyle: {
      color: textColor,
    }
  } : undefined

  const axisLabel = textColor ? {
    color: textColor,
  } : undefined

  const splitLine = lineColor ? {
    lineStyle: {
      color: lineColor,
    }
  } : {}

  const legend = data.series.length > 1 ? {
    top: 'bottom',
    textStyle,
  } : undefined
  const palette = data.seriesColors && data.seriesColors.length ? data.seriesColors : themeColors

  if (type === 'bar' || type === 'column') {
    const defaultOrientation = type === 'column' ? 'vertical' : 'horizontal';
    const resolvedOrientation = orientation || defaultOrientation;
    const isVertical = resolvedOrientation === 'vertical';

    const categoryAxis = {
      type: 'category' as const,
      data: data.labels,
      axisLine,
      axisLabel,
    };

    const valueAxis = {
      type: 'value' as const,
      axisLine,
      axisLabel,
      splitLine,
    };

    const borderRadius: [number, number, number, number] = isVertical
      ? [2, 2, 0, 0]
      : [0, 2, 2, 0];

    return {
      color: palette,
      textStyle,
      legend,
      xAxis: isVertical ? categoryAxis : valueAxis,
      yAxis: isVertical ? valueAxis : categoryAxis,
      series: data.series.map((item, index) => {
        const seriesItem: BarSeriesOption = {
          data: data.series.length === 1
            ? buildColoredSeriesData(item, data.dataColors, palette)
            : item,
          name: data.legends[index],
          type: 'bar',
          label: {
            show: true,
          },
          itemStyle: {
            borderRadius,
          },
        }
        if (stack) seriesItem.stack = 'A'
        if (barWidth) seriesItem.barWidth = barWidth
        if (barCategoryGap) seriesItem.barCategoryGap = barCategoryGap
        return seriesItem
      }),
    }
  }
  if (type === 'line') {
    return {
      color: palette,
      textStyle,
      legend,
      xAxis: {
        type: 'category',
        data: data.labels,
        axisLine,
        axisLabel,
      },
      yAxis: {
        type: 'value',
        axisLine,
        axisLabel,
        splitLine,
      },
      series: data.series.map((item, index) => {
        const seriesItem: LineSeriesOption = {
          data: data.series.length === 1
            ? buildColoredSeriesData(item, data.dataColors, palette)
            : item,
          name: data.legends[index],
          type: 'line',
          smooth: lineSmooth,
          label: {
            show: true,
          },
        }
        if (stack) seriesItem.stack = 'A'
        return seriesItem
      }),
    }
  }
  if (type === 'pie') {
    return {
      color: palette,
      textStyle,
      legend: {
        top: 'bottom',
        textStyle,
      },
      series: [
        {
          data: data.series[0].map((item, index) => ({
            value: item,
            name: data.labels[index],
            itemStyle: {
              color: (data.dataColors && data.dataColors[index]) || palette[index % palette.length],
            },
          })),
          label: textColor ? {
            color: textColor,
          } : {},
          type: 'pie',
          radius: '70%',
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold'
            },
          },
        }
      ],
    }
  }
  if (type === 'ring') {
    return {
      color: palette,
      textStyle,
      legend: {
        top: 'bottom',
        textStyle,
      },
      series: [
        {
          data: data.series[0].map((item, index) => ({
            value: item,
            name: data.labels[index],
            itemStyle: {
              color: (data.dataColors && data.dataColors[index]) || palette[index % palette.length],
            },
          })),
          label: textColor ? {
            color: textColor,
          } : {},
          type: 'pie',
          radius: ['40%', '70%'],
          padAngle: 1,
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold'
            },
          },
        }
      ],
    }
  }
  if (type === 'area') {
    return {
      color: palette,
      textStyle,
      legend,
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.labels,
        axisLine,
        axisLabel,
      },
      yAxis: {
        type: 'value',
        axisLine,
        axisLabel,
        splitLine,
      },
      series: data.series.map((item, index) => {
        const seriesItem: LineSeriesOption = {
          data: data.series.length === 1
            ? buildColoredSeriesData(item, data.dataColors, palette)
            : item,
          name: data.legends[index],
          type: 'line',
          areaStyle: {},
          label: {
            show: true,
          },
        }
        if (stack) seriesItem.stack = 'A'
        return seriesItem
      }),
    }
  }
  if (type === 'radar') {
    // indicator 中不设置max时显示异常，设置max后控制台警告，无解，等EChart官方修复此bug
    // const values: number[] = []
    // for (const item of data.series) {
    //   values.push(...item)
    // }
    // const max = Math.max(...values)

    return {
      color: palette,
      textStyle,
      legend,
      radar: {
        indicator: data.labels.map(item => ({ name: item })),
        splitLine,
        axisLine: lineColor ? {
          lineStyle: {
            color: lineColor,
          }
        } : undefined,
      },
      series: [
        {
          data: data.series.map((item, index) => ({ value: item, name: data.legends[index] })),
          type: 'radar',
        },
      ],
    }
  }
  if (type === 'scatter') {
    const formatedData = []
    for (let i = 0; i < data.series[0].length; i++) {
      const x = data.series[0][i]
      const y = data.series[1] ? data.series[1][i] : x
      formatedData.push([x, y])
    }

    const clampSize = (val: number) => Math.max(4, Math.min(32, val))

    return {
      color: palette,
      textStyle,
      xAxis: {
        axisLine,
        axisLabel,
        splitLine,
      },
      yAxis: {
        axisLine,
        axisLabel,
        splitLine,
      },
      series: [
        {
          symbolSize: (val: number[], params: { dataIndex: number }) => {
            if (!pointSizes || pointSizes[params.dataIndex] === undefined) return 12
            return clampSize(pointSizes[params.dataIndex])
          },
          data: formatedData,
          type: 'scatter',
        }
      ],
    }
  }
  if (type === 'combo') {
    const resolvedSeriesTypes =
      seriesTypes && seriesTypes.length === data.series.length
        ? seriesTypes
        : data.series.map(() => 'bar')

    return {
      color: palette,
      textStyle,
      legend: {
        top: 'bottom',
        textStyle,
      },
      xAxis: {
        type: 'category',
        data: data.labels,
        axisLine,
        axisLabel,
      },
      yAxis: {
        type: 'value',
        axisLine,
        axisLabel,
        splitLine,
      },
      series: data.series.map((item, index) => {
        const seriesType = resolvedSeriesTypes[index] || 'bar'
        if (seriesType === 'line' || seriesType === 'area') {
          const lineSeries: LineSeriesOption = {
            data: item,
            name: data.legends[index],
            type: 'line',
            smooth: lineSmooth,
            label: {
              show: true,
            },
          }
          if (seriesType === 'area') {
            lineSeries.areaStyle = {}
          }
          return lineSeries
        }
        const barSeries: BarSeriesOption = {
          data: item,
          name: data.legends[index],
          type: 'bar',
          label: {
            show: true,
          },
          itemStyle: {
            borderRadius: [2, 2, 0, 0],
          },
        }
        if (stack) barSeries.stack = 'A'
        return barSeries
      }),
    }
  }

  return null
}
