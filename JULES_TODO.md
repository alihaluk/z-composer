# Jules' Handover Notes

## Current Status
We have successfully implemented the core Z-Composer features, including:
- **Canvas Operations**: Drag & Drop, Resizing, Snapping (Center/Edge alignment).
- **Zoom & Panning**: Using CSS transform scaling.
- **Data Binding**: Integrated centralized `dataSources` with mock data and "Text Preview" mode.
- **Undo/Redo**: Fully functional using `zundo`.
- **File Operations**: Save/Load/Clear canvas state.
- **Invoice Template**: A pre-loaded template with GIB formatting.

## Recent Fixes (Important Context)
- **Drag & Drop Logic**: We switched from `delta`-based positioning to `rect`-based positioning in `App.tsx` (`handleDragEnd`). This was because elements loaded from templates were reporting `delta: 0` in `dnd-kit` sensors. **Do not revert to delta-based logic without testing the Invoice Template loading flow.**
- **Zoom Handling**: `DragOverlay` and `Guides` are carefully handled to work with CSS scaling. The overlay uses a specific `pointer-events-none` class to avoid blocking drops.

## Next Steps for You (Jules)

### 1. Custom Image Upload (Priority)
- **Goal**: Allow users to upload their own images (logos, etc.) instead of just the placeholder "GIB Logo".
- **Implementation Ideas**:
    - Add an "Upload Image" button to the Sidebar.
    - Store the image as a base64 string or a blob URL in the `CanvasElement` content.
    - **Crucial**: Update `zplGenerator.ts` to convert this image to ZPL Hex format (`^GF`). You might need a helper library or function to convert standard image formats (PNG/JPG) to ZPL hex string. Reference `image-to-zpl` or similar algorithms.
    - Ensure the uploaded image resizes correctly on the canvas and in the ZPL output.

### 2. Refine ZPL Preview
- Currently, we just show a basic ZPL dump.
- **Improvement**: When an element is selected, highlight or show *only* that element's ZPL code in the Properties Panel for easier debugging.
- **Doc Access**: We added a "Toggle Preview Mode" (Text vs ZPL). Ensure this persists or is easy to switch.

### 3. Testing & Optimization
- **Performance**: Test with 50+ elements.
- **Mobile/Tablet**: Check drag-and-drop on touch devices (we have `TouchSensor` enabled but it needs verification).

Good luck! We've built a solid foundation.
