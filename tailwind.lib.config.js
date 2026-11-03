import base from './tailwind.config.js';

/** Tailwind for the library build: no global reset, utilities scoped to the designer root. */
export default {
  ...base,
  important: '.zc-root',
  corePlugins: { preflight: false, container: false },
};
