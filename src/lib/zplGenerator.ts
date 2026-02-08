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

    // Helper to render an element at offsetY (mm)
    const renderElement = (el: CanvasElement, offsetYMm: number, localData?: any) => {
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
            // Marker for mobile parser: [IMAGE:Key]
            // We use a comment or a specific field to make it parseable
            command += `^GB${wDots},${hDots},1^FS`; // Draw a thin box as placeholder
            command += `^FO${xDots},${yDots}^A0N,15,15^FD[IMG:${el.imageKey || 'NONE'}]^FS`;
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
    };

    // 2. Render Header
    header.elements.forEach(el => {
        zpl += renderElement(el, 0);
    });

    // 3. Render Body (Loop)
    // When generating a template (no mock data), we only render one body row with markers
    const itemsToRender = useMockData ? mockItems : 1;
    for (let i = 0; i < itemsToRender; i++) {
        const rowOffsetMm = header.height + (i * body.height);
        const mockRowData = useMockData ? MOCK_DATA_ROWS[i % MOCK_DATA_ROWS.length] : undefined;

        body.elements.forEach(el => {
            zpl += renderElement(el, rowOffsetMm, mockRowData);
        });
    }

    // 4. Render Footer
    const footerOffsetMm = header.height + (itemsToRender * body.height);
    footer.elements.forEach(el => {
        zpl += renderElement(el, footerOffsetMm);
    });

    zpl += '^XZ';
    return zpl;
}
