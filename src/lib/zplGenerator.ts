import { type SectionState, type CanvasElement } from '../types';
import { MM_TO_PX } from './constants';

const DOTS_PER_MM = 8;
const PX_TO_MM = 1 / MM_TO_PX;

function pxToDots(px: number): number {
    return Math.round(px * PX_TO_MM * DOTS_PER_MM);
}

function mmToDots(mm: number): number {
    return Math.round(mm * DOTS_PER_MM);
}

function ptToDots(pt: number): number {
    return Math.round(pt * (203 / 72));
}

function getOrientation(rotation: number = 0): string {
    switch (rotation) {
        case 90: return 'R';
        case 180: return 'I';
        case 270: return 'B';
        default: return 'N';
    }
}

import { MOCK_DATA_ROWS, MOCK_GLOBAL_DATA } from './dataSources';

export function generateElementZPL(
    el: CanvasElement,
    useMockData: boolean = false,
    offsetYMm: number = 0,
    localData?: any
): string {
    const xDots = pxToDots(el.x);
    const yDots = mmToDots(offsetYMm) + pxToDots(el.y);
    const fontSizeDots = ptToDots(el.fontSize || 12);

    let command = `^FO${xDots},${yDots}`;

    if (el.type === 'box') {
        const wDots = pxToDots(el.width || 0);
        const hDots = pxToDots(el.height || 0);
        command += `^GB${wDots},${hDots},2^FS`; // Border thickness 2
    } else if (el.type === 'barcode') {
        const orientation = getOrientation(el.rotation);
        let content = el.content || '';
        if (el.isDynamic && el.dataSource) {
            if (useMockData) {
                const dataSource = el.dataSource;
                if (localData && localData[dataSource]) {
                    content = localData[dataSource];
                } else if (MOCK_GLOBAL_DATA[dataSource]) {
                    content = MOCK_GLOBAL_DATA[dataSource];
                } else {
                    content = `[${dataSource}]`;
                }
            } else {
                content = `[${el.dataSource}]`;
            }
        }

        if (el.barcodeType === 'qr') {
            // ^BQo,m,n
            // m=2 (Model 2), n=scaling (1-10)
            const scale = Math.max(1, Math.min(10, Math.round((el.width || 50) / 25)));
            command += `^BQN,2,${scale}^FDQA,${content}^FS`;
        } else {
            // Default to Code 128
            // ^BCo,h,f,g,e
            const hDots = pxToDots(el.height || 50);
            const showInterpretation = el.showLabel ? 'Y' : 'N';
            command += `^BC${orientation},${hDots},${showInterpretation},N,N^FD${content}^FS`;
        }
    } else if (el.type === 'image') {
        const wDots = pxToDots(el.width || 60);
        const hDots = pxToDots(el.height || 60);

        if (el.zplImage && el.zplImage.hex) {
             const { hex, totalBytes, bytesPerRow } = el.zplImage;
             command += `^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hex}^FS`;
        } else {
            // Marker for mobile parser: [IMAGE:Key]
            // We use a comment or a specific field to make it parseable
            command += `^GB${wDots},${hDots},1^FS`; // Draw a thin box as placeholder
            command += `^FO${xDots},${yDots}^A0N,15,15^FD[IMG:${el.imageKey || 'NONE'}]^FS`;
        }
    } else {
        // Text
        const orientation = getOrientation(el.rotation);
        command += `^A0${orientation},${fontSizeDots},${fontSizeDots}`;

        let content = el.content || '';
        if (el.isDynamic && el.dataSource) {
            if (useMockData) {
                const dataSource = el.dataSource;
                if (localData && localData[dataSource]) {
                    content = localData[dataSource];
                } else if (MOCK_GLOBAL_DATA[dataSource]) {
                    content = MOCK_GLOBAL_DATA[dataSource];
                } else {
                    content = `[${dataSource}]`;
                }
            } else {
                content = `[${el.dataSource}]`;
            }
        }

        // Basic truncation/max chars
        if (el.maxChars && content.length > el.maxChars) {
            // Do not truncate if it's a marker (template mode)
            const isMarker = !useMockData && el.isDynamic;
            if (!isMarker) {
                content = content.substring(0, el.maxChars) + '...';
            }
        }

        command += `^FD${content}^FS`;
    }
    return command + '\n';
}

export function generateZPL(
    header: SectionState,
    body: SectionState,
    footer: SectionState,
    mockItems: number = 3,
    useMockData: boolean = false,
    canvasWidth: number = 104
): string {
    let zpl = '^XA\n^CI28\n'; // Start, UTF-8

    // 1. Calculate Total Height for ^LL
    // Header + Body * N + Footer
    const totalHeightMm = header.height + (body.height * mockItems) + footer.height;
    zpl += `^LL${mmToDots(totalHeightMm)}\n`;
    zpl += `^PW${mmToDots(canvasWidth)}\n`; // Print Width

    // 2. Render Header
    header.elements.forEach(el => {
        zpl += generateElementZPL(el, useMockData, 0);
    });

    // 3. Render Body (Loop)
    // When generating a template (no mock data), we only render one body row with markers
    const itemsToRender = useMockData ? mockItems : 1;
    for (let i = 0; i < itemsToRender; i++) {
        const rowOffsetMm = header.height + (i * body.height);
        const mockRowData = useMockData ? MOCK_DATA_ROWS[i % MOCK_DATA_ROWS.length] : undefined;

        body.elements.forEach(el => {
            zpl += generateElementZPL(el, useMockData, rowOffsetMm, mockRowData);
        });
    }

    // 4. Render Footer
    const footerOffsetMm = header.height + (itemsToRender * body.height);
    footer.elements.forEach(el => {
        zpl += generateElementZPL(el, useMockData, footerOffsetMm);
    });

    zpl += '^XZ';
    return zpl;
}

export function generateLinePrint(
    header: SectionState,
    body: SectionState,
    footer: SectionState,
    mockItems: number = 3,
    useMockData: boolean = false,
    canvasWidthMm: number = 104
): string {
    let output = '=== LINE PRINT MODE (FIXED WIDTH PREVIEW) ===\n';
    output += `Paper Width: ${canvasWidthMm}mm (Approx 80 chars)\n\n`;

    // Assumptions for Line Print
    // 1 char approx 2.5mm width? No, standard is 10-12 CPI.
    // Let's assume 10 CPI -> 10 chars per inch -> 1 char per 2.54mm.
    // 104mm / 2.54 = ~40 chars.
    // Wait, 832 dots / 203dpi = 4 inches. 4 * 10 = 40 chars? That's quite narrow.
    // Usually receipt printers (80mm) fit 42-48 columns (Font A) or 56-64 columns (Font B).
    // Let's assume a standard 48 column width for 80mm paper, or scale based on canvasWidth.
    // If 80mm -> 48 cols, then 1mm = 0.6 cols.
    // canvasWidth * 0.6 = totalCols.
    const COLS_PER_MM = 0.6;

    // Helper to render a section line-by-line using spatial layout
    const processSection = (elements: CanvasElement[], rowData?: any) => {
        // 1. Resolve content first
        const resolvedElements = elements.map(el => {
            let content = '';
            if (el.type === 'box') {
                // Horizontal lines can be simulated
                if ((el.height || 0) < 5 && (el.width || 0) > 20) content = '-'.repeat(Math.floor((el.width || 0) * MM_TO_PX / 10)); // Rough guess
            } else if (el.type === 'text') {
                 content = el.content || '';
                if (el.isDynamic && el.dataSource) {
                    if (useMockData) {
                        const ds = el.dataSource;
                        if (rowData && rowData[ds]) content = rowData[ds];
                        else if (MOCK_GLOBAL_DATA[ds]) content = MOCK_GLOBAL_DATA[ds];
                        else content = `[${ds}]`;
                    } else {
                        content = `[${el.dataSource}]`;
                    }
                }
            } else if (el.type === 'barcode' || el.type === 'image') {
                return null; // Skip graphics in line print
            }

            if (!content) return null;

            // Convert X (px) to Column Index
            // px -> mm -> col
            const xMm = el.x / MM_TO_PX; // px / (3.78) is wrong. MM_TO_PX is approx 3.78 (96dpi/25.4).
            // constant MM_TO_PX is typically 3.7795...
            const colIndex = Math.floor(xMm * COLS_PER_MM);

            return {
                y: el.y,
                x: el.x,
                col: colIndex,
                content
            };
        }).filter(Boolean) as { y: number, x: number, col: number, content: string }[];

        // 2. Group by Y (Line)
        // We cluster elements that are within ~4mm Y-distance of each other
        const lines: { y: number, items: typeof resolvedElements }[] = [];

        // Sort by Y first
        resolvedElements.sort((a, b) => a.y - b.y);

        resolvedElements.forEach(item => {
            // Find existing line group?
            const existingLine = lines.find(l => Math.abs(l.y - item.y) < 15); // 15px threshold (~4mm)
            if (existingLine) {
                existingLine.items.push(item);
            } else {
                lines.push({ y: item.y, items: [item] });
            }
        });

        // 3. Render each line
        let sectionOutput = '';

        lines.forEach(line => {
            // Sort items by X (Column)
            line.items.sort((a, b) => a.col - b.col);

            let lineStr = '';
            let currentCol = 0;

            line.items.forEach(item => {
                // Add padding
                if (item.col > currentCol) {
                    lineStr += ' '.repeat(item.col - currentCol);
                    currentCol = item.col;
                }

                // If overlap (col < currentCol), we assume space or overwrite?
                // Just append a space if overlaps to ensure separation
                if (item.col < currentCol) {
                     lineStr += ' ';
                     currentCol++;
                }

                lineStr += item.content;
                currentCol += item.content.length;
            });
            sectionOutput += lineStr + '\n';
        });

        return sectionOutput;
    };

    output += '--- HEADER ---\n';
    output += processSection(header.elements) + '\n';

    output += '--- BODY ---\n';
    const itemsToRender = useMockData ? mockItems : 1;
    for (let i = 0; i < itemsToRender; i++) {
        const mockRowData = useMockData ? MOCK_DATA_ROWS[i % MOCK_DATA_ROWS.length] : undefined;
        // output += `[Row ${i + 1}]\n`;
        output += processSection(body.elements, mockRowData);
    }
    output += '\n';

    output += '--- FOOTER ---\n';
    output += processSection(footer.elements) + '\n';

    return output;
}
