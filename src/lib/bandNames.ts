import { type TFunction } from 'i18next';
import { type PresetBandNames } from './presets';
import { type BandNames } from './templateIO';

/** Band names of new templates in the interface language. */
export const bandNames = (t: TFunction): BandNames => ({ header: t('bands.names.header'), lines: t('bands.names.lines'), footer: t('bands.names.footer') });

export const presetBandNames = (t: TFunction): PresetBandNames => ({
  ...bandNames(t), vatTitle: t('bands.names.vatTitle'), vatLines: t('bands.names.vatLines'), totals: t('bands.names.totals'),
  payments: t('bands.names.payments'), signatures: t('bands.names.signatures'), discount: t('bands.names.discount'),
});
