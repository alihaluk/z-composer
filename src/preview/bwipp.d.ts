// The BWIPP encoders inside bwip-js (node_modules/bwip-js/dist/bwipp.mjs), aliased in the Vite configs.
declare module '@bwipp' {
  type Encoder = (...args: unknown[]) => unknown;
  export const bwipp_code128: Encoder;
  export const bwipp_qrcode: Encoder;
  export function bwipp_encode(bw: object, encoder: Encoder, text: string, options: Record<string, unknown>, dontdraw: true): unknown[];
}
