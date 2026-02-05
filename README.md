# z-composer
A WYSIWYG ZPL template designer specifically built for dynamic thermal receipts, invoices, and packing slips. Move beyond static labels.

Z-Composer is a modern React-based tool designed to replace legacy Dot Matrix template editors. Unlike standard label designers that work with fixed heights, Z-Composer utilizes a Header-Body-Footer architecture to generate ZPL (Zebra Programming Language) code for variable-length documents.

Key Features:

Stacked Canvas: Dedicated sections for Header (Fixed), Body (Loop/Repeater), and Footer (Fixed).

Dynamic Data Binding: Drag-and-drop elements and bind them to dynamic data sources (e.g., Product.Name, Invoice.Total) or set static text.

Smart Truncation: Built-in logic for middle-truncation of long text fields.

Live Preview: Real-time rendering via Labelary API.

ZPL Generation: Automatic calculation of label length (^LL) based on line item count.
