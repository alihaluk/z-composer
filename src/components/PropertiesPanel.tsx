import { useStore } from '../store/useStore';
import { Label } from './ui/Label';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

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
    setSectionHeight
  } = useStore();

  if (!selectedElementId || !selectedSection) {
    // Show Canvas Properties
    return (
        <div className="p-4 space-y-4">
            <h3 className="font-bold border-b pb-2 text-gray-800">Canvas Settings</h3>

            <div className="space-y-2">
                <Label>Header Height (mm)</Label>
                <Input
                    type="number"
                    value={header.height}
                    onChange={(e) => setSectionHeight('header', Number(e.target.value))}
                />
            </div>
             <div className="space-y-2">
                <Label>Body Row Height (mm)</Label>
                <Input
                    type="number"
                    value={body.height}
                    onChange={(e) => setSectionHeight('body', Number(e.target.value))}
                />
            </div>
             <div className="space-y-2">
                <Label>Footer Height (mm)</Label>
                <Input
                    type="number"
                    value={footer.height}
                    onChange={(e) => setSectionHeight('footer', Number(e.target.value))}
                />
            </div>
        </div>
    );
  }

  // Find the element
  const section = selectedSection === 'header' ? header : selectedSection === 'body' ? body : footer;
  const element = section.elements.find(el => el.id === selectedElementId);

  if (!element) return <div className="p-4">Element not found</div>;

  const handleChange = (key: string, value: any) => {
    updateElement(selectedSection, selectedElementId, { [key]: value });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="font-bold text-gray-800">Element Properties</h3>
        <Button size="sm" variant="ghost" onClick={() => selectElement(null, null)}>Close</Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
            <Label htmlFor="prop-x">X (px)</Label>
            <Input id="prop-x" type="number" value={Math.round(element.x)} onChange={(e) => handleChange('x', Number(e.target.value))} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="prop-y">Y (px)</Label>
            <Input id="prop-y" type="number" value={Math.round(element.y)} onChange={(e) => handleChange('y', Number(e.target.value))} />
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

      {!element.isDynamic ? (
          <div className="space-y-2">
            <Label htmlFor="prop-content">Content</Label>
            <Input id="prop-content" value={element.content || ''} onChange={(e) => handleChange('content', e.target.value)} />
          </div>
      ) : (
          <div className="space-y-2">
            <Label htmlFor="prop-source">Data Source</Label>
            <Select id="prop-source" value={element.dataSource || ''} onChange={(e) => handleChange('dataSource', e.target.value)}>
                <option value="">Select Source...</option>
                <option value="Invoice.Date">Invoice.Date</option>
                <option value="Customer.Name">Customer.Name</option>
                <option value="Line.ProductCode">Line.ProductCode</option>
                <option value="Line.Price">Line.Price</option>
                <option value="Line.Qty">Line.Qty</option>
                <option value="Invoice.Total">Invoice.Total</option>
            </Select>
          </div>
      )}

       <div className="space-y-2">
        <Label htmlFor="prop-fontsize">Font Size (pt)</Label>
        <Input id="prop-fontsize" type="number" value={element.fontSize || 12} onChange={(e) => handleChange('fontSize', Number(e.target.value))} />
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

      <div className="pt-4 border-t mt-4">
          <Button variant="outline" className="w-full text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200" onClick={() => removeElement(selectedSection, selectedElementId)}>
              Delete Element
          </Button>
      </div>
    </div>
  );
};
