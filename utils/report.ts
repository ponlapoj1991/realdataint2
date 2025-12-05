
import { Project, ReportSlide, ReportElement, TableCell } from '../types';

export const generatePowerPoint = async (project: Project, dashboardElement: HTMLElement, activeFiltersStr: string = '') => {
  if (!window.PptxGenJS || !window.html2canvas) {
    alert("Export libraries are not fully loaded. Please refresh the page.");
    return;
  }

  const pptx = new window.PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'RealData Intelligence';
  pptx.company = 'RealData Agency';
  pptx.title = project.name;

  // --- Slide 1: Title Slide ---
  let slide = pptx.addSlide();
  
  // Background accent
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.15, fill: '0047BA' }); // Top bar

  slide.addText('Social Listening Report', { 
      x: 0.5, y: 1.5, w: '90%', fontSize: 14, color: '666666', bold: true, align: 'left' 
  });
  
  slide.addText(project.name, { 
      x: 0.5, y: 2.0, w: '90%', fontSize: 44, bold: true, color: '003366', align: 'left' 
  });

  if (activeFiltersStr) {
    slide.addText(`Filters Applied: ${activeFiltersStr}`, { 
        x: 0.5, y: 3.0, w: '90%', fontSize: 12, color: 'E07A5F', italic: true 
    });
  }

  slide.addText(`Generated on: ${new Date().toLocaleDateString()}`, { 
      x: 0.5, y: 5.0, fontSize: 12, color: '888888' 
  });

  slide.addText(project.description || '', { 
      x: 0.5, y: 3.5, w: '80%', fontSize: 16, color: '444444' 
  });

  // --- Processing Charts ---
  // We identify widgets by a specific class name 'report-widget' added in Analytics.tsx
  const widgets = dashboardElement.querySelectorAll('.report-widget');
  
  for (let i = 0; i < widgets.length; i++) {
    const widgetEl = widgets[i] as HTMLElement;
    
    // Extract metadata
    const titleEl = widgetEl.querySelector('.widget-title');
    const title = titleEl?.textContent || `Chart ${i + 1}`;
    
    const metaEl = widgetEl.querySelector('.widget-meta');
    const meta = metaEl?.textContent || '';

    try {
        // Use html2canvas to take a screenshot of the widget
        // Scale 2 for better retina quality in PPT
        const canvas = await window.html2canvas(widgetEl, { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff' // Ensure white background
        });
        const imgData = canvas.toDataURL('image/png');

        // Add new Slide
        const slide = pptx.addSlide();
        
        // Slide Header
        slide.addText(title, { x: 0.5, y: 0.4, fontSize: 24, bold: true, color: '333333' });
        slide.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.9, w: '90%', h: 0, line: { color: '0047BA', width: 2 } });
        
        // Slide Metadata
        if(meta) {
             slide.addText(meta, { x: 0.5, y: 1.0, fontSize: 11, color: '888888', italic: true });
        }

        // Add Image
        slide.addImage({ 
            data: imgData, 
            x: 0.5, 
            y: 1.3, 
            w: 9.0, 
            h: 4.0, 
            sizing: { type: 'contain', w: 9.0, h: 4.0 } 
        });

        // Footer
        slide.addText('RealData Intelligence', { x: 8.5, y: 5.3, fontSize: 10, color: 'CCCCCC' });

    } catch (e) {
        console.error(`Failed to capture widget index ${i}`, e);
    }
  }

  pptx.writeFile({ fileName: `${project.name}_Report_${new Date().toISOString().slice(0,10)}.pptx` });
};

// Phase 5: Custom Report Generation from Canvas
const PPT_WIDTH_INCH = 10;
const PPT_HEIGHT_INCH = 5.625;

const pxToInches = (value: number, canvasSize: number, pptSize: number) => (value / canvasSize) * pptSize;
const normalizeColor = (color?: string) => color ? color.replace('#', '') : undefined;
const parseFontSize = (size?: string) => {
    if (!size) return undefined;
    const num = parseFloat(size);
    return Number.isFinite(num) ? num : undefined;
};
const isBold = (weight?: string) => {
    if (!weight) return false;
    if (weight === 'bold') return true;
    const numeric = parseInt(weight, 10);
    return Number.isFinite(numeric) ? numeric >= 600 : false;
};
const isUnderline = (decoration?: string) => decoration?.includes('underline');

const addTableToSlide = (
    slide: any,
    element: ReportElement,
    tableCells: TableCell[][],
    columnWidths: number[] | undefined,
    canvasWidth: number,
    canvasHeight: number
) => {
    const x = pxToInches(element.x, canvasWidth, PPT_WIDTH_INCH);
    const y = pxToInches(element.y, canvasHeight, PPT_HEIGHT_INCH);
    const w = pxToInches(element.w, canvasWidth, PPT_WIDTH_INCH);
    const h = pxToInches(element.h, canvasHeight, PPT_HEIGHT_INCH);

    const rows = tableCells.map(row => row.map(cell => ({
        text: cell.text,
        options: {
            colspan: cell.colSpan,
            rowspan: cell.rowSpan,
            color: normalizeColor(cell.style?.color),
            fill: normalizeColor(cell.style?.backgroundColor),
            align: cell.style?.textAlign,
            bold: isBold(cell.style?.fontWeight),
            fontFace: cell.style?.fontFamily,
            fontSize: parseFontSize(cell.style?.fontSize)
        }
    })));

    const colW = columnWidths?.length
        ? columnWidths.map(widthPercent => (widthPercent / 100) * w)
        : undefined;

    slide.addTable(rows, {
        x, y, w, h,
        colW
    });
};

const waitForFonts = async () => {
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
        try {
            await (document as any).fonts.ready;
        } catch (err) {
            console.warn("Font loading wait failed", err);
        }
    }
};

const waitForImages = async (slides: ReportSlide[]) => {
    const promises: Promise<void>[] = [];
    slides.forEach(slide => {
        if (slide.background?.startsWith('data:')) {
            promises.push(new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Background image failed to load'));
                img.src = slide.background as string;
            }));
        }

        slide.elements.forEach(el => {
            if (el.type === 'image' && el.content) {
                promises.push(new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error('Element image failed to load'));
                    img.src = el.content as string;
                }));
            }
        });
    });

    if (promises.length) {
        try {
            await Promise.all(promises);
        } catch (err) {
            console.warn('Image preload failed', err);
        }
    }
};

export const validateSlidesForPptx = async (slides: ReportSlide[]) => {
    const issues: string[] = [];

    if (!window.PptxGenJS) {
        issues.push("Export libraries not loaded. Refresh and try again.");
    }

    if (!slides.length) {
        issues.push("No slides to export.");
    }

    let hasContent = false;

    slides.forEach((slide, sIdx) => {
        if (slide.elements.length > 0 || slide.background) hasContent = true;
        else issues.push(`Slide ${sIdx + 1} is empty. Add content or a background before exporting.`);

        slide.elements.forEach((el, eIdx) => {
            if (el.type === 'image' && !el.content) {
                issues.push(`Slide ${sIdx + 1} element ${eIdx + 1} missing image data`);
            }
            if (el.w <= 0 || el.h <= 0) {
                issues.push(`Slide ${sIdx + 1} element ${eIdx + 1} has invalid dimensions`);
            }
            if (el.type === 'table' && (!el.tableData || el.tableData.rows.length === 0)) {
                issues.push(`Slide ${sIdx + 1} table ${eIdx + 1} is empty`);
            }
            if (el.type === 'chart' && (!el.chartData || !el.chartData.data || el.chartData.data.length === 0)) {
                issues.push(`Slide ${sIdx + 1} chart ${eIdx + 1} has no data`);
            }
        });
    });

    if (!hasContent) {
        issues.push("All slides are empty. Add elements before exporting.");
    }

    await waitForFonts();
    await waitForImages(slides);

    return issues;
};

const ensurePptxExportReady = async (slides: ReportSlide[]) => {
    const issues = await validateSlidesForPptx(slides);
    if (issues.length) {
        const err: any = new Error(issues.join('\n'));
        err.issues = issues;
        throw err;
    }
};

export const generateCustomReport = async (
  project: Project,
  slides: ReportSlide[],
  canvasWidth: number,
  canvasHeight: number
) => {
  await ensurePptxExportReady(slides);

  const pptx = new window.PptxGenJS();
  pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches

  for (const slideData of slides) {
      const slide = pptx.addSlide();

      if (slideData.background) {
          if (slideData.background.startsWith('data:')) {
              slide.background = { path: slideData.background };
          } else {
              slide.background = { color: normalizeColor(slideData.background) };
          }
      }

      const orderedElements = [...slideData.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

      for (const el of orderedElements) {
          const x = pxToInches(el.x, canvasWidth, PPT_WIDTH_INCH);
          const y = pxToInches(el.y, canvasHeight, PPT_HEIGHT_INCH);
          const w = pxToInches(el.w, canvasWidth, PPT_WIDTH_INCH);
          const h = pxToInches(el.h, canvasHeight, PPT_HEIGHT_INCH);
          const rotation = el.style?.rotation || 0;

          if (el.type === 'text') {
              slide.addText(el.content || '', {
                  x, y, w, h,
                  color: normalizeColor(el.style?.color),
                  fontFace: el.style?.fontFamily,
                  fontSize: parseFontSize(el.style?.fontSize),
                  bold: isBold(el.style?.fontWeight),
                  italic: el.style?.fontStyle === 'italic',
                  underline: isUnderline(el.style?.textDecoration),
                  align: el.style?.textAlign,
                  fill: normalizeColor(el.style?.backgroundColor),
                  rotate: rotation,
                  valign: 'top',
                  margin: 2
              });
          } else if (el.type === 'image' && el.content) {
              slide.addImage({ data: el.content, x, y, w, h, rotate: rotation });
          } else if (el.type === 'shape') {
              let shapeType = pptx.ShapeType.rect;
              if (el.shapeType === 'circle') shapeType = pptx.ShapeType.ellipse;
              else if (el.shapeType === 'triangle') shapeType = pptx.ShapeType.triangle;
              else if (el.shapeType === 'line') shapeType = pptx.ShapeType.line;
              else if (el.shapeType === 'arrow') shapeType = pptx.ShapeType.rightArrow;
              else if (el.shapeType === 'star') shapeType = pptx.ShapeType.star5;

              slide.addShape(shapeType, {
                  x, y, w, h,
                  fill: normalizeColor(el.style?.fill || el.style?.backgroundColor),
                  line: {
                      color: normalizeColor(el.style?.stroke),
                      width: el.style?.strokeWidth || 0
                  },
                  rotate: rotation
              });
          } else if (el.type === 'table' && el.tableData) {
              addTableToSlide(slide, el, el.tableData.rows, el.tableData.columnWidths, canvasWidth, canvasHeight);
          } else if (el.type === 'chart' && el.chartData) {
              const labels = el.chartData.data.map((d: any) => d.name || '');
              const values = el.chartData.data.map((d: any) => Number(d.value) || 0);
              const chartTypeMap: Record<string, any> = {
                  bar: pptx.ChartType.bar,
                  pie: pptx.ChartType.pie,
                  line: pptx.ChartType.line,
                  area: pptx.ChartType.area
              };
              const chartType = chartTypeMap[el.chartData.chartType];

              if (chartType) {
                  slide.addChart(chartType, [
                      { name: el.chartData.title || 'Series 1', labels, values }
                  ], {
                      x, y, w, h,
                      showLegend: false,
                      dataLabelColor: '666666',
                      catAxisLabelFontSize: 10,
                      valAxisLabelFontSize: 10
                  });
              }
          } else {
              console.warn('Unsupported element for PPT export', el.type);
          }
      }
  }

  pptx.writeFile({ fileName: `${project.name}_CustomReport.pptx` });
};