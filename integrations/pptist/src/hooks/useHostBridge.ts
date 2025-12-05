import { onBeforeUnmount, onMounted } from 'vue'
import type { ChartData, ChartOptions, ChartType } from '@/types/slides'
import useCreateElement from './useCreateElement'
import useSlideHandler from './useSlideHandler'
import { useSlidesStore } from '@/store'

interface DashboardChartMessage {
  chartType: ChartType
  data: ChartData
  options?: ChartOptions
  theme?: {
    colors?: string[]
    textColor?: string
    lineColor?: string
  }
  meta?: {
    widgetTitle?: string
    widgetId?: string
    sourceDashboardId?: string
  }
}

export default () => {
  const { createImageElement, createChartElement } = useCreateElement()
  const slidesStore = useSlidesStore()
  const { resetSlides } = useSlideHandler()

  const emitPresentationExport = () => {
    const slides = JSON.parse(JSON.stringify(slidesStore.slides || []))
    const theme = JSON.parse(JSON.stringify(slidesStore.theme || {}))
    const payload = {
      slides,
      title: slidesStore.title,
      theme,
    }
    window.parent?.postMessage({
      source: 'pptist',
      type: 'presentation-export',
      payload,
    }, '*')
  }

  const handleMessage = (event: MessageEvent) => {
    if (typeof event.data !== 'object' || !event.data) return
    if (event.data?.source !== 'realdata-host') return

    if (event.data?.type === 'insert-dashboard-image') {
      const dataUrl = event.data?.payload?.dataUrl
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
        createImageElement(dataUrl)
      }
    }

    if (event.data?.type === 'insert-dashboard-chart') {
      const payload = event.data?.payload as DashboardChartMessage | undefined
      if (payload?.chartType && payload.data) {
        createChartElement(payload.chartType, {
          data: payload.data,
          options: payload.options,
          themeColors: payload.theme?.colors,
          textColor: payload.theme?.textColor,
          lineColor: payload.theme?.lineColor,
          name: payload.meta?.widgetTitle,
          // Automation Report: Store link to Dashboard widget
          widgetId: payload.meta?.widgetId,
          dashboardId: payload.meta?.sourceDashboardId,
        })
      }
    }

    if (event.data?.type === 'request-presentation-export') {
      emitPresentationExport()
    }

    if (event.data?.type === 'load-presentation') {
      const payload = event.data?.payload as { slides?: any[]; title?: string; theme?: any } | undefined
      if (payload?.slides && Array.isArray(payload.slides)) {
        if (payload.slides.length === 0) {
          resetSlides()
        }
        else {
          slidesStore.setSlides(payload.slides)
          slidesStore.updateSlideIndex(0)
        }
      }
      if (payload?.title) {
        slidesStore.setTitle(payload.title)
      }
      if (payload?.theme) {
        slidesStore.setTheme(payload.theme)
      }
    }

    // Automation Report: Handle updated chart data from Dashboard
    if (event.data?.type === 'update-chart-data') {
      const payload = event.data?.payload as {
        elementId: string
        data: ChartData
        options?: ChartOptions
        theme?: { colors?: string[]; textColor?: string; lineColor?: string }
      } | undefined

      if (payload?.elementId && payload.data) {
        // Find the chart element and update it
        const slides = slidesStore.slides.map(slide => ({
          ...slide,
          elements: slide.elements.map(el => {
            if (el.id === payload.elementId && el.type === 'chart') {
              return {
                ...el,
                data: payload.data,
                options: payload.options || el.options,
                themeColors: payload.theme?.colors || el.themeColors,
                textColor: payload.theme?.textColor || el.textColor,
                lineColor: payload.theme?.lineColor || el.lineColor,
              }
            }
            return el
          }),
        }))
        slidesStore.setSlides(slides)
      }
    }
  }

  onMounted(() => {
    window.addEventListener('message', handleMessage)
    window.parent?.postMessage({
      source: 'pptist',
      type: 'ready',
    }, '*')
  })

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleMessage)
  })
}
