import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';

function Fallback({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center bg-gray-100 p-6" role="alert">
      <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow">
        <h2 className="font-semibold text-gray-800">{t('errorBoundary.title')}</h2>
        <p className="mt-2 text-sm text-gray-600">{t('errorBoundary.text')}</p>
        <Button className="mt-4" onClick={onReset}>{t('errorBoundary.reset')}</Button>
      </div>
    </div>
  );
}

/** A design that cannot be drawn must not take the page down with it, nor block the designer after a reload. */
export class DesignerErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <Fallback onReset={() => { this.props.onReset(); this.setState({ failed: false }); }} />;
  }
}
