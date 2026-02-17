# Z-Composer (Invoice Designer)

A React-based visual designer for creating ZPL (Zebra Programming Language) invoice templates.

![Project Status](https://img.shields.io/badge/Status-Phase%201%20Complete-green)

## Features
- **Visual Drag & Drop**: Add Text, Box, Barcode, Image elements with snap-to-grid and alignment guides.
- **Dynamic Data Binding**: Bind elements to `[Product.Name]`, `[Total]`, etc.
- **Canvas Zoom**: Scale the workspace (25% - 300%) for precise editing.
- **Specific Invoice Layout**: Pre-built template matching GIB requirements (Logos, Totals, QR).
- **ZPL Preview**: Instant visual preview using Labelary API.
- **Custom Image Upload**: Upload images, convert to monochrome, and generate ZPL hex (`^GFA`) automatically.
- **Keyboard Navigation**: Move selected elements with Arrow keys (Shift+Arrow for 10px steps).
- **Line Print Mode**: Support for text-only output simulation.
- **Real-time Code Preview**: View generated ZPL or Text output instantly in the properties panel.
- **Customizable**: Adjust canvas width (mm), font sizes, rotation, and more.

## Installation

```bash
npm install
npm run dev
```

## Live Demo

Visit the live demo at: [https://alihaluk.github.io/z-composer/](https://alihaluk.github.io/z-composer/)

## Integration
See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for details on how to embed this component into your web application.

## Deployment

This project is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

To deploy manually:
1. Build the project: `npm run build`
2. The built files will be in the `dist` folder
3. The GitHub Actions workflow will handle the deployment automatically

## Roadmap

### Phase 2: Advanced Features & Refinements
- [x] **Line Print Mode**: Support for Zebra Line Print Mode (Text-only output).
- [x] **Custom Image Upload**: Allow users to upload images and convert to ZPL hex (`^GF`).
- [ ] **Refine ZPL Preview**: Context-aware preview (Element vs Document).
- [x] **Enhanced Drag & Drop**: Fix zoom coordinate issues and implement element snapping.
- [ ] **Templates Management**: Save/Load different templates from local storage or API.
- [ ] **Undo/Redo**: History management for actions.

### Backlog
- [ ] Multi-page support
- [ ] Advanced Barcode properties (width ratio, check digit)
