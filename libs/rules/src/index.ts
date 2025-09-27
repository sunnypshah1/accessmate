import { imgAltRule } from './rules/img-alt.js';
import { buttonTypeRule } from './rules/button-type.js';
import { inputLabelRule } from './rules/input-label.js';

export { imgAltRule, buttonTypeRule, inputLabelRule };

export const configs = {
  recommended: {
    plugins: ['@accessmate/rules'],
    rules: {
      '@accessmate/rules/img-alt': 'error',
      '@accessmate/rules/input-label': 'error',
      '@accessmate/rules/button-type': 'warn',
    },
  },
};

export const rules = {
  'img-alt': imgAltRule,
  'button-type': buttonTypeRule,
  'input-label': inputLabelRule,
};

const plugin = {
  rules,
  configs,
};

export default plugin;
