import { ZComposer } from './ZComposer';

// Standalone app (GitHub Pages): templates are kept in this browser's local storage.
function App() {
  return (
    <div className="h-screen">
      <header className="sr-only"><h1>Z-Composer</h1></header>
      <ZComposer />
    </div>
  );
}

export default App;
