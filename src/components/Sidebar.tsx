import { useDraggable } from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { Type, Square, Barcode, Image, QrCode, RotateCcw, RotateCw, Save, Trash } from 'lucide-react';
import { cn } from '../lib/utils';
import { PreviewModal } from './PreviewModal';
import { useStore } from '../store/useStore';
import { Button } from './ui/Button';
import { MM_TO_PX } from '../lib/constants';

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
  const { clearCanvas, header, body, footer, canvasWidth, setTemplate, savedTemplates, saveTemplate, loadTemplate, deleteTemplate, currentTemplateName } = useStore();
  const [templateName, setTemplateName] = useState('');

  const undo = () => useStore.temporal?.getState().undo();
  const redo = () => useStore.temporal?.getState().redo();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSaveFile = () => {
    try {
      const template = {
        header,
        body,
        footer,
        canvasWidth,
        version: 1,
        createdAt: new Date().toISOString()
      };
      const jsonString = JSON.stringify(template, null, 2);
      // Use application/octet-stream to force download
      const blob = new Blob([jsonString], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `z-composer-template-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export template. Check console for details.');
    }
  };

  const handleLoadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const template = JSON.parse(content);

        // Basic validation
        if (!template.header || !template.body || !template.footer) {
          alert('Invalid template file format');
          return;
        }

        setTemplate(template);
      } catch (error) {
        console.error('Failed to parse template:', error);
        alert('Failed to load template');
      }
      // Reset input
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleSaveLocal = () => {
    if (!templateName.trim()) return alert('Please enter a template name');
    saveTemplate(templateName);
    setTemplateName('');
  };

  const handleUpdateTemplate = () => {
    if (currentTemplateName) {
      saveTemplate(currentTemplateName);
      // Optional: Visual feedback
      // alert('Template updated!');
    }
  };

  return (
    <div className="p-4 flex flex-col h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800">Toolbox</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => undo()} title="Undo (Ctrl+Z)">
            <RotateCcw size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => redo()} title="Redo (Ctrl+Shift+Z)">
            <RotateCw size={14} />
          </Button>
        </div>
      </div>
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
          <SidebarItem type="barcode" label="Gib QR Code" icon={QrCode} extraData={{ barcodeType: 'qr', dataSource: 'GibInfo', isDynamic: true, width: 80, height: 80 }} />
        </div>
      </div>

      <div className="pt-4 border-t mt-4 space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Saved Templates</h3>

        {/* Update Button for Current Template */}
        {currentTemplateName && (
          <div className="mb-2">
            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs" onClick={handleUpdateTemplate}>
              Update "{currentTemplateName}"
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            className="flex-1 text-xs border rounded px-2 h-8"
            placeholder="New Template Name..."
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <Button size="sm" variant="outline" className="h-8" onClick={handleSaveLocal} title="Save New">
            <Save size={14} />
          </Button>
        </div>
        <div className="max-h-32 overflow-y-auto space-y-1 mt-2">
          {savedTemplates.length === 0 && <p className="text-[10px] text-gray-400">No saved templates</p>}
          {savedTemplates.map(t => (
            <div
              key={t.name}
              className={cn(
                "flex justify-between items-center text-xs p-1 rounded group",
                currentTemplateName === t.name ? "bg-blue-50 border border-blue-100" : "bg-gray-50 border border-transparent"
              )}
            >
              <span className="truncate flex-1 cursor-pointer hover:text-blue-600" onClick={() => loadTemplate(t.name)}>
                {t.name}
                {currentTemplateName === t.name && <span className="ml-1 text-[9px] text-blue-400">(active)</span>}
              </span>
              <button className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteTemplate(t.name)}>
                <Trash size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>


      <div className="pt-4 border-t mt-auto space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">File Operations</h3>
        <div className="mb-2">
          <Button variant="ghost" className="w-full text-[10px] text-gray-400 h-6" onClick={() => {
            for (let i = 0; i < 50; i++) {
              const id = Math.random().toString(36).substr(2, 9);
              useStore.getState().addElement('body', {
                id, type: 'text', x: (i % 5) * 20, y: Math.floor(i / 5) * 10,
                content: `Item ${i}`, fontSize: 8, isDynamic: false, width: 40, height: 10
              });
            }
          }}>Add 50 Elements (Test)</Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="text-xs h-8 px-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={clearCanvas}>
            Clear
          </Button>
          <Button variant="outline" className="text-xs h-8 px-0" onClick={handleSaveFile} title="Download JSON">
            Export
          </Button>
          <Button variant="outline" className="text-xs h-8 px-0" onClick={() => document.getElementById('load-template-input')?.click()} title="Upload JSON">
            Import
          </Button>
          <input
            type="file"
            id="load-template-input"
            className="hidden"
            accept=".json"
            onChange={handleLoadFile}
          />
        </div>

        <Button variant="outline" className="w-full text-xs" onClick={() => {
          loadInvoiceTemplate();
        }}>
          Load Preset Invoice
        </Button>
        <PreviewModal />
      </div>
    </div>
  );
};

// Helper to load template
// import { useStore } from '../store/useStore'; // Already imported at top
// import { Button } from './ui/Button'; // Already imported
// import { MM_TO_PX } from '../lib/constants'; // Already imported

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
