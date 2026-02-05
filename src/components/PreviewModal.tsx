import { useState } from 'react';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import { generateZPL } from '../lib/zplGenerator';
import { Loader2 } from 'lucide-react';

export const PreviewModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [zplCode, setZplCode] = useState('');

    const { header, body, footer } = useStore();

    const handlePreview = async () => {
        setIsOpen(true);
        setLoading(true);
        setImageUrl(null);

        // Generate ZPL with 3 mock items
        const zpl = generateZPL(header, body, footer, 3);
        setZplCode(zpl);

        const totalHeightMm = header.height + (body.height * 3) + footer.height;
        const heightInch = Math.max(1, totalHeightMm / 25.4);

        try {
            // Use Labelary API
            // 8dpmm = 203 dpi
            const url = `https://api.labelary.com/v1/printers/8dpmm/labels/4x${heightInch.toFixed(2)}/0/`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'image/png', // Explicitly ask for PNG
                },
                body: zpl
            });

            if (response.ok) {
                const blob = await response.blob();
                setImageUrl(URL.createObjectURL(blob));
            } else {
                console.error("Labelary API error:", await response.text());
            }
        } catch (e) {
            console.error("Preview fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button onClick={handlePreview} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm">
                Preview ZPL
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-800">ZPL Preview</h2>
                            <Button variant="ghost" onClick={() => setIsOpen(false)}>Close</Button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            <div className="w-1/2 p-4 border-r overflow-auto bg-gray-50">
                                <h3 className="font-bold mb-2 text-sm text-gray-500 uppercase">Generated Code</h3>
                                <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-white p-2 border rounded text-gray-700">{zplCode}</pre>
                            </div>
                            <div className="w-1/2 p-4 flex items-start justify-center bg-gray-200 overflow-auto">
                                {loading ? (
                                    <div className="flex flex-col items-center gap-2 mt-20">
                                        <Loader2 className="animate-spin text-gray-500" size={32} />
                                        <span className="text-gray-500 text-sm">Rendering Label...</span>
                                    </div>
                                ) : imageUrl ? (
                                    <img src={imageUrl} alt="Label Preview" className="shadow-2xl border-2 border-white max-w-full" />
                                ) : (
                                    <span className="text-red-500 mt-20">Failed to load preview. Check console.</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
