import { useDraggable } from '@dnd-kit/core';
import { Type, Square, Barcode, Image, QrCode } from 'lucide-react';
import { cn } from '../lib/utils';
import { PreviewModal } from './PreviewModal';

interface SidebarItemProps {
  type: string;
  label: string;
  icon: any;
  extraData?: Record<string, any>;
}

export const SidebarItem = ({ type, label, icon: Icon, extraData }: SidebarItemProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tool-${type}-${label}`,
    data: {
      type: 'tool',
      toolType: type,
      ...extraData,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 p-3 mb-2 bg-white border rounded shadow-sm cursor-move hover:bg-gray-50 transition-colors",
        isDragging && "opacity-50 ring-2 ring-blue-500"
      )}
    >
      <Icon size={16} />
      <span>{label}</span>
    </div>
  );
};

export const Sidebar = () => {
  return (
    <div className="p-4 flex flex-col h-full">
      <h2 className="text-lg font-bold mb-4 text-gray-800">Toolbox</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Basic Elements</h3>
          <SidebarItem type="text" label="Text Field" icon={Type} />
          <SidebarItem type="box" label="Box / Line" icon={Square} />
          <SidebarItem type="barcode" label="Barcode" icon={Barcode} />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Visual Elements</h3>
          <SidebarItem type="image" label="Tenant Logo" icon={Image} extraData={{ imageKey: 'TenantLogo' }} />
          <SidebarItem type="image" label="Gib Logo" icon={Image} extraData={{ imageKey: 'GibLogo' }} />
          <SidebarItem type="image" label="Gib QR Code" icon={QrCode} extraData={{ imageKey: 'GibQRCode' }} />
        </div>
      </div>

      <div className="mt-8 text-xs text-gray-500 flex-1">
        <p>Drag items to the canvas.</p>
      </div>

      <div className="pt-4 border-t mt-auto space-y-2">
        <Button variant="outline" className="w-full text-xs" onClick={() => {
          loadInvoiceTemplate();
        }}>
          Load Invoice Template
        </Button>
        <PreviewModal />
      </div>
    </div>
  );
};

// Helper to load template
import { useStore } from '../store/useStore';
import { Button } from './ui/Button';
import { MM_TO_PX } from '../lib/constants';

const loadInvoiceTemplate = () => {
  const { addElement, clearCanvas, setSectionHeight, canvasWidth } = useStore.getState();

  clearCanvas();

  // Set Heights roughly based on the receipt photo
  setSectionHeight('header', 65); // Reduced from 130 to remove gap (content ends approx ~235px)
  setSectionHeight('body', 6); // Compact rows
  setSectionHeight('footer', 60); // Totals and signatures

  const generateId = () => Math.random().toString(36).substr(2, 9);
  const widthPx = canvasWidth * MM_TO_PX;
  const centerX = widthPx / 2;
  const padding = 10;
  const safeWidth = widthPx - (padding * 2);

  // --- HEADER ---

  // 1. GIB Logo (Top Center)
  addElement('header', {
    id: generateId(), type: 'image', x: centerX - 20, y: 5, width: 40, height: 40, imageKey: 'GibLogo', isDynamic: false
  });

  // 2. Tenant Logo (Below GIB)
  addElement('header', {
    id: generateId(), type: 'image', x: centerX - 30, y: 50, width: 60, height: 20, imageKey: 'TenantLogo', isDynamic: false
  });

  // 3. e-Fatura Label
  addElement('header', {
    id: generateId(), type: 'text', x: centerX - 15, y: 75, fontSize: 8, content: 'e-Fatura', isDynamic: false
  });

  // 4. Tenant Details (Left Aligned Block) - reduced font size
  let currentY = 90;
  addElement('header', { id: generateId(), type: 'text', x: padding, y: currentY, fontSize: 8, fontBold: true, isDynamic: true, dataSource: 'Tenant.Name', maxChars: 40 });
  currentY += 10;
  addElement('header', { id: generateId(), type: 'text', x: padding, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'Tenant.Address', maxChars: 50 });
  currentY += 15; // Gap

  // 5. Tenant Tax Info & Contact
  addElement('header', { id: generateId(), type: 'text', x: padding, y: currentY, fontSize: 8, content: 'Tel: ', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: padding + 20, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'Tenant.Phone' });

  // Align Tax info to right of the same line
  const rightColX = widthPx / 2 + 20;
  addElement('header', { id: generateId(), type: 'text', x: rightColX, y: currentY, fontSize: 8, content: 'VKN:', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: rightColX + 25, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'Tenant.TaxNumber' });

  currentY += 10;
  addElement('header', { id: generateId(), type: 'text', x: rightColX, y: currentY, fontSize: 8, content: 'V.D.:', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: rightColX + 25, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'Tenant.TaxOffice' });

  currentY += 15; // Gap

  // 6. Invoice Details (Grid)
  // Row 1: Belge No | Tarih
  addElement('header', { id: generateId(), type: 'text', x: padding, y: currentY, fontSize: 8, content: 'Belge No:', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: padding + 40, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'DocNumber' });

  addElement('header', { id: generateId(), type: 'text', x: rightColX, y: currentY, fontSize: 8, content: 'Tarih:', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: rightColX + 30, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'DocDate' });

  currentY += 10;
  // Row 2: Saat | ETTN (simplified grid)
  addElement('header', { id: generateId(), type: 'text', x: padding, y: currentY, fontSize: 8, content: 'Saat:', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: padding + 40, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'DocTime' });

  addElement('header', { id: generateId(), type: 'text', x: rightColX, y: currentY, fontSize: 8, content: 'ETTN:', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: rightColX + 30, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'ETTN', maxChars: 15 });

  currentY += 10;
  // Row 3: Vade | Tip
  addElement('header', { id: generateId(), type: 'text', x: padding, y: currentY, fontSize: 8, content: 'Vade:', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: padding + 40, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'PaymentDueDate' });

  addElement('header', { id: generateId(), type: 'text', x: rightColX, y: currentY, fontSize: 8, content: 'Tip:', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: rightColX + 30, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'PaymentType' });

  currentY += 20;

  // 7. Customer Info
  addElement('header', { id: generateId(), type: 'text', x: padding, y: currentY, fontSize: 8, fontBold: true, content: 'SAYIN', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: padding + 30, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'Customer.Name' });

  currentY += 10;
  addElement('header', { id: generateId(), type: 'text', x: padding, y: currentY, fontSize: 8, isDynamic: true, dataSource: 'Customer.Street1', maxChars: 50 });

  currentY += 15;
  // 8. Title "*** SATIS FATURASI ***"
  addElement('header', { id: generateId(), type: 'text', x: centerX - 50, y: currentY, fontSize: 9, fontBold: true, content: '*** SATIS FATURASI ***', isDynamic: false });

  currentY += 15;
  // 9. Table Headers
  const col1 = padding;
  // Add right padding: shift columns left by 10px
  // Add right padding: shift columns left by 10px
  const rightPadding = 10;
  // Shift Unit (col3) and Quantity (col2) further left to avoid overlap with Price (col4)
  const colShift = 15;
  const col2 = widthPx - 160 - rightPadding - colShift;
  const col3 = widthPx - 110 - rightPadding - colShift;
  const col4 = widthPx - 70 - rightPadding;
  const col5 = widthPx - 30 - rightPadding; // Shifted left to leave space

  addElement('header', { id: generateId(), type: 'text', x: col1, y: currentY, fontSize: 8, fontBold: true, content: 'Urun', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: col2, y: currentY, fontSize: 8, fontBold: true, content: 'Miktar', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: col3, y: currentY, fontSize: 8, fontBold: true, content: 'Birim', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: col4, y: currentY, fontSize: 8, fontBold: true, content: 'Fiyat', isDynamic: false });
  addElement('header', { id: generateId(), type: 'text', x: col5, y: currentY, fontSize: 8, fontBold: true, content: 'Tutar', isDynamic: false });

  // Separator Line
  addElement('header', { id: generateId(), type: 'box', x: padding, y: currentY + 12, width: safeWidth, height: 2, isDynamic: false });


  // --- BODY ---
  // Single Row Layout matching headers
  addElement('body', { id: generateId(), type: 'text', x: col1, y: 3, fontSize: 8, isDynamic: true, dataSource: 'Product.Name', maxChars: 18 });
  addElement('body', { id: generateId(), type: 'text', x: col2, y: 3, fontSize: 8, isDynamic: true, dataSource: 'Quantity' });
  addElement('body', { id: generateId(), type: 'text', x: col3, y: 3, fontSize: 8, isDynamic: true, dataSource: 'Unit.Name' }); // Using Unit.Name
  addElement('body', { id: generateId(), type: 'text', x: col4, y: 3, fontSize: 8, isDynamic: true, dataSource: 'Price' });
  addElement('body', { id: generateId(), type: 'text', x: col5, y: 3, fontSize: 8, isDynamic: true, dataSource: 'Total' });


  // --- FOOTER ---
  let footerY = 5;
  const labelsX = widthPx - 180 - rightPadding; // Apply same padding shift
  const valuesX = widthPx - 80 - rightPadding;  // Apply same padding shift

  // Totals Block
  addElement('footer', { id: generateId(), type: 'text', x: labelsX, y: footerY, fontSize: 8, content: 'Ara Toplam:', isDynamic: false });
  addElement('footer', { id: generateId(), type: 'text', x: valuesX, y: footerY, fontSize: 8, isDynamic: true, dataSource: 'NetTotal' }); // Ara toplam = Net usually

  footerY += 10;
  addElement('footer', { id: generateId(), type: 'text', x: labelsX, y: footerY, fontSize: 8, content: 'Top. Indirim:', isDynamic: false });
  addElement('footer', { id: generateId(), type: 'text', x: valuesX, y: footerY, fontSize: 8, isDynamic: true, dataSource: 'Discount' });

  footerY += 10;
  addElement('footer', { id: generateId(), type: 'text', x: labelsX, y: footerY, fontSize: 8, content: 'Top. KDV:', isDynamic: false });
  addElement('footer', { id: generateId(), type: 'text', x: valuesX, y: footerY, fontSize: 8, isDynamic: true, dataSource: 'VatTotal' });

  footerY += 10;
  addElement('footer', { id: generateId(), type: 'text', x: labelsX, y: footerY, fontSize: 9, fontBold: true, content: 'GENEL TOPLAM:', isDynamic: false });
  addElement('footer', { id: generateId(), type: 'text', x: valuesX, y: footerY, fontSize: 9, fontBold: true, isDynamic: true, dataSource: 'VatIncludeTotal' });

  // Bottom Section
  footerY += 20;
  // Signatures
  const sigY = footerY;
  addElement('footer', { id: generateId(), type: 'text', x: padding, y: sigY, fontSize: 8, content: 'Teslim Eden: Imza', isDynamic: false });
  addElement('footer', { id: generateId(), type: 'text', x: rightColX, y: sigY, fontSize: 8, content: 'Teslim Alan: Imza', isDynamic: false });

  // Signature Box - Increased height
  addElement('footer', { id: generateId(), type: 'box', x: padding, y: sigY + 5, width: safeWidth, height: 40, isDynamic: false });

  // Disclaimer
  addElement('footer', { id: generateId(), type: 'text', x: padding, y: sigY + 50, fontSize: 6, content: 'e-Fatura izni kapsaminda elektronik ortamda iletilmistir.', isDynamic: false });

  // QR Code (Bottom Center) - Increased Size and using GibInfo
  const qrSize = 80; // Bigger QR
  addElement('footer', {
    id: generateId(), type: 'barcode', barcodeType: 'qr', x: centerX - (qrSize / 2), y: sigY + 65, width: qrSize, height: qrSize, isDynamic: true, dataSource: 'GibInfo'
  });
};
