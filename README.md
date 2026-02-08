# Z-Composer (Invoice Designer)

A React-based visual designer for creating ZPL (Zebra Programming Language) invoice templates.

![Project Status](https://img.shields.io/badge/Status-Phase%201%20Complete-green)

## Features (Phase 1)
- **Visual Drag & Drop**: Add Text, Box, Barcode, Image elements.
- **Dynamic Data Binding**: Bind elements to `[Product.Name]`, `[Total]`, etc.
- **Canvas Zoom**: Scale the workspace (25% - 300%) for precise editing.
- **Specific Invoice Layout**: Pre-built template matching GIB requirements (Logos, Totals, QR).
- **ZPL Preview**: Instant visual preview using Labelary API.
- **Customizable**: Adjust canvas width (mm), font sizes, rotation, and more.

## Installation

```bash
npm install
npm run dev
```

## Integration
See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for details on how to embed this component into your web application.

## Roadmap

### Phase 2: Advanced Features
- [ ] **Line Print Mode**: Support for text-based dot matrix printers (ESC/POS).
- [ ] **Custom Image Upload**: Allow users to upload images and convert to ZPL hex (`^GF`).
- [ ] **Templates Management**: Save/Load different templates from local storage or API.
- [ ] **Undo/Redo**: History management for actions.

### Backlog
- [ ] Multi-page support
- [ ] Advanced Barcode properties (width ratio, check digit)
