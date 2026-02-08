import { useStore } from '../store/useStore';
import { Label } from './ui/Label';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { generateZPL } from '../lib/zplGenerator';
import { GLOBAL_DATA_SOURCES, ALL_DATA_SOURCES } from '../lib/dataSources';

export const PropertiesPanel = () => {
  const {
    selectedElementId,
    selectedSection,
    header,
    body,
    footer,
    updateElement,
    removeElement,
    selectElement,
    setSectionHeight,
    canvasWidth,
    setCanvasWidth,
    zoomLevel,
    setZoomLevel
  } = useStore();

  if (!selectedElementId || !selectedSection) {
    // Show Canvas Properties
    return (
      <div className="p-4 space-y-4">
        <h3 className="font-bold border-b pb-2 text-gray-800">Canvas Settings</h3>

        <div className="space-y-2">
          <Label>Paper Width (mm)</Label>
          <Input
            type="number"
            value={canvasWidth}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setCanvasWidth(Number(e.target.value))}
            max={104}
          />
          <p className="text-[10px] text-gray-400">Max 104mm (4 inches)</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Zoom Level</Label>
            <span className="text-xs text-gray-500">{Math.round(zoomLevel * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.25"
            max="3"
            step="0.05"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>25%</span>
            <button onClick={() => setZoomLevel(1)} className="hover:text-blue-500">Reset (100%)</button>
            <span>300%</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Header Height (mm)</Label>
          <Input
            type="number"
            value={header.height}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setSectionHeight('header', Math.min(500, Number(e.target.value)))}
          />
        </div>
        <div className="space-y-2">
          <Label>Body Row Height (mm)</Label>
          <Input
            type="number"
            value={body.height}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setSectionHeight('body', Math.min(500, Number(e.target.value)))}
          />
        </div>
        <div className="space-y-2">
          <Label>Footer Height (mm)</Label>
          <Input
            type="number"
            value={footer.height}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setSectionHeight('footer', Math.min(500, Number(e.target.value)))}
          />
        </div>
      </div>
    );
  }

  // Find the element
  const section = selectedSection === 'header' ? header : selectedSection === 'body' ? body : footer;
  const element = section.elements.find(el => el.id === selectedElementId);

  if (!element) return <div className="p-4">Element not found</div>;

  const zplCode = generateZPL(header, body, footer, 1, false, canvasWidth);

  const handleChange = (key: string, value: any) => {
    console.log(`Updating element ${selectedElementId} in ${selectedSection}: ${key} =`, value);
    updateElement(selectedSection!, selectedElementId!, { [key]: value });
  };

  let sectionDataSources = selectedSection === 'body'
    ? ALL_DATA_SOURCES
    : GLOBAL_DATA_SOURCES;

  // Filter based on element type and specific requirements
  if (element.type === 'barcode') {
    if (element.barcodeType === 'qr') {
      // User Request: QR Code -> GibInfo
      sectionDataSources = sectionDataSources.filter(ds => ds.id === 'GibInfo');
    } else {
      // User Request: Code 128 -> Product Barcode (or similar identifiers)
      // We filter for fields that look like barcodes or codes
      sectionDataSources = sectionDataSources.filter(ds =>
        ds.id === 'Barcode' ||
        ds.id === 'Product.Sku' ||
        ds.id === 'DocNumber' ||
        ds.id === 'ETTN'
      );
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="font-bold text-gray-800">Element Properties</h3>
        <Button size="sm" variant="ghost" onClick={() => selectElement(null, null)}>Close</Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="prop-x">X (px)</Label>
          <Input id="prop-x" type="number" value={Math.round(element.x)} onFocus={(e) => e.target.select()} onChange={(e) => handleChange('x', Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prop-y">Y (px)</Label>
          <Input id="prop-y" type="number" value={Math.round(element.y)} onFocus={(e) => e.target.select()} onChange={(e) => handleChange('y', Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prop-w">Width (px)</Label>
          <Input id="prop-w" type="number" value={Math.round(element.width || 0)} onFocus={(e) => e.target.select()} onChange={(e) => handleChange('width', Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prop-h">Height (px)</Label>
          <Input id="prop-h" type="number" value={Math.round(element.height || 0)} onFocus={(e) => e.target.select()} onChange={(e) => handleChange('height', Number(e.target.value))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Data Binding</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="w-1/2"
            variant={!element.isDynamic ? 'default' : 'outline'}
            onClick={() => handleChange('isDynamic', false)}
          >
            Static
          </Button>
          <Button
            size="sm"
            className="w-1/2"
            variant={element.isDynamic ? 'default' : 'outline'}
            onClick={() => handleChange('isDynamic', true)}
          >
            Dynamic
          </Button>
        </div>
      </div>

      {element.type === 'image' ? (
        <div className="space-y-2">
          <Label htmlFor="prop-imagekey">Image Key</Label>
          <Select id="prop-imagekey" value={element.imageKey || ''} onChange={(e) => handleChange('imageKey', e.target.value)}>
            <option value="">Select Image...</option>
            <option value="TenantLogo">Tenant Logo (dynamic)</option>
            <option value="GibLogo">Gib Logo (standard)</option>
            <option value="GibQRCode">Gib QR Code (automatic)</option>
          </Select>
        </div>
      ) : element.isDynamic ? (
        <div className="space-y-2">
          <Label htmlFor="prop-source">Data Source</Label>
          <Select id="prop-source" value={element.dataSource || ''} onChange={(e) => handleChange('dataSource', e.target.value)}>
            <option value="">Select Source...</option>
            {Object.entries(
              sectionDataSources.reduce((groups, ds) => {
                const parts = ds.id.split('.');
                const groupName = parts.length > 1 ? parts[0] : 'General';
                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(ds);
                return groups;
              }, {} as Record<string, typeof sectionDataSources>)
            ).sort((a, b) => a[0].localeCompare(b[0])) // Sort groups alphabetically
              .map(([group, sources]) => (
                <optgroup key={group} label={group}>
                  {sources.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </optgroup>
              ))}
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="prop-content">Content</Label>
          <Input
            id="prop-content"
            value={element.content || ''}
            onFocus={(e) => e.target.select()}
            onChange={(e) => handleChange('content', e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="prop-fontsize">Font Size (pt)</Label>
        <Input
          id="prop-fontsize"
          type="number"
          value={element.fontSize || 12}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleChange('fontSize', Number(e.target.value))}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="prop-bold"
            checked={element.fontBold || false}
            onChange={(e) => handleChange('fontBold', e.target.checked)}
            className="h-4 w-4 border border-input rounded shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Label htmlFor="prop-bold">Bold</Label>
        </div>
      </div>

      {
        element.type === 'barcode' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="prop-barcodetype">Barcode Type</Label>
              <Select
                id="prop-barcodetype"
                value={element.barcodeType || 'code128'}
                onChange={(e) => handleChange('barcodeType', e.target.value)}
              >
                <option value="code128">Code 128</option>
                <option value="qr">QR Code</option>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="prop-showlabel"
                  checked={element.showLabel ?? true}
                  onChange={(e) => handleChange('showLabel', e.target.checked)}
                  className="h-4 w-4 border border-input rounded shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Label htmlFor="prop-showlabel">Show Label</Label>
              </div>
            </div>
          </>
        )
      }

      <div className="space-y-2">
        <Label htmlFor="prop-rotation">Rotation</Label>
        <Select
          id="prop-rotation"
          value={element.rotation || 0}
          onChange={(e) => handleChange('rotation', Number(e.target.value))}
        >
          <option value={0}>0° (Normal)</option>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prop-maxchars">Max Characters</Label>
        <Input id="prop-maxchars" type="number" value={element.maxChars || 0} onChange={(e) => handleChange('maxChars', Number(e.target.value))} />
      </div>

      <div className="pt-4 border-t mt-4 space-y-2">
        {zplCode && (
          <div className="mt-2">
            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Preview ZPL (Element Only)</p>
            <pre className="text-[9px] bg-gray-50 p-2 border rounded overflow-x-auto text-gray-600 font-mono">
              {zplCode.split('\n').filter((l: string) => l.includes('^FO')).join('\n')}
            </pre>
          </div>
        )}
        <Button variant="outline" className="w-full text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200" onClick={() => removeElement(selectedSection, selectedElementId)}>
          Delete Element
        </Button>
      </div>
    </div >
  );
};
