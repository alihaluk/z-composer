import { generateZPL } from './lib/zplGenerator';
import { type SectionState } from './types';

// Mock Data
const header: SectionState = {
    height: 40,
    elements: [
        { id: '1', type: 'text', x: 10, y: 10, isDynamic: false, content: 'HEADER LOGO', width: 0, height: 0 }
    ]
};

const body: SectionState = {
    height: 10,
    elements: [
        { id: '2', type: 'text', x: 10, y: 2, isDynamic: true, dataSource: 'Line.ProductCode', width: 0, height: 0 }
    ]
};

const footer: SectionState = {
    height: 20,
    elements: [
        { id: '3', type: 'text', x: 10, y: 5, isDynamic: true, dataSource: 'Invoice.Total', width: 0, height: 0 }
    ]
};

const zpl = generateZPL(header, body, footer, 2);
console.log('--- Generated ZPL ---');
console.log(zpl);
console.log('---------------------');

if (zpl.includes('^LL')) console.log('PASS: Label Length found');
if (zpl.includes('P-101')) console.log('PASS: Body Loop (Mock Data P-101 found)');
if (zpl.includes('P-102')) console.log('PASS: Body Loop (Mock Data P-102 found)');
if (zpl.includes('190.95')) console.log('PASS: Footer Data found');
