# Invoice Composer Integration Guide

This guide explains how to integrate the **Invoice Composer** (Z-Composer) into an existing web application.

## 1. Overview
The Invoice Composer is a React-based component that allows users to design ZPL-based invoice templates visually. It outputs raw ZPL code that can be sent directly to supported thermal printers (e.g., Zebra).

## 2. Technical Stack
- **Framework:** React (18+)
- **State Management:** Zustand
- **Drag & Drop:** @dnd-kit/core
- **Styling:** Tailwind CSS
- **Icons:** lucide-react

## 3. Integration Steps

### 3.1. Installation
Ensure the host application supports React and Tailwind CSS.
Copy the `src` folder components into your project (e.g., `src/components/invoice-composer`).

### 3.2. Embedding the Component
The main entry point is `App.tsx` (can be renamed to `InvoiceDesigner.tsx`).

```tsx
import InvoiceDesigner from './components/invoice-composer/App';

function MyPage() {
  return (
    <div className="h-screen w-full">
      <InvoiceDesigner />
    </div>
  );
}
```

### 3.3. Key Components
- **Sidebar**: Drag-and-drop source (Toolbox).
- **Canvas**: Drop target (Design Area).
- **PropertiesPanel**: Configuration for selected elements.
- **PreviewModal**: Visualizes the ZPL output using Labelary API.

### 3.4. Data Sources (`dataSources.ts`)
The template uses a centralized data definitions file.
- **`GLOBAL_DATA_SOURCES`**: Header/Footer fields (e.g., Tenant Info, Invoice Date).
- **`ROW_DATA_SOURCES`**: Body fields (e.g., Product Name, Price).

To connect real application data:
1. Fetch your invoice data.
2. Update the `MOCK_GLOBAL_DATA` and `MOCK_DATA_ROWS` in `dataSources.ts` OR inject data via props if refactoring `useStore` to accept external state.

## 4. ZPL Output
The `generateZPL` function (`src/lib/zplGenerator.ts`) converts the visual state into ZPL string.

**Output Example:**
```zpl
^XA
^PW832
^FO10,10^A0N,24,24^FD[Tenant.Name]^FS
...
^XZ
```
The output contains **markers** like `[Tenant.Name]` which should be replaced by the backend/printing service with actual values before sending to the printer.

## 5. Future Considerations
- **Line Print Mode**: Future versions will support text-based output for dot matrix printers.
