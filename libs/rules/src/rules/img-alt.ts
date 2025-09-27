import type { TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/sunnypshah1/accessmate/rules/${name}`);

type MessageIds = 'missingAlt' | 'emptyAlt';

function getElementName(node: TSESTree.JSXOpeningElement): string | null {
  if (node.name.type === 'JSXIdentifier') {
    return node.name.name;
  }

  if (node.name.type === 'JSXMemberExpression') {
    return node.name.property.type === 'JSXIdentifier' ? node.name.property.name : null;
  }

  return null;
}

function isImage(node: TSESTree.JSXOpeningElement) {
  return getElementName(node) === 'img';
}

function getAltAttribute(node: TSESTree.JSXOpeningElement) {
  return node.attributes.find((attr): attr is TSESTree.JSXAttribute => attr.type === 'JSXAttribute' && attr.name.name === 'alt');
}

export const imgAltRule = createRule<[{ enforceMeaningful?: boolean }], MessageIds>({
  name: 'img-alt',
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure <img> elements have meaningful alt text',
    },
    fixable: 'code',
    messages: {
      missingAlt: 'Provide an alt attribute for this image to describe its contents.',
      emptyAlt: 'Alt text should not be empty unless the image is decorative.',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          enforceMeaningful: { type: 'boolean' },
        },
      },
    ],
  },
  defaultOptions: [{ enforceMeaningful: false }],
  create(context, [options]) {
    return {
      JSXOpeningElement(node) {
        if (!isImage(node)) {
          return;
        }

        const alt = getAltAttribute(node);
        if (!alt) {
          context.report({
            node,
            messageId: 'missingAlt',
            fix(fixer) {
              const insertionPoint = node.range![1] - 1;
              return fixer.insertTextBeforeRange([insertionPoint, insertionPoint], ' alt="TODO"');
            },
          });
          return;
        }

        if (!alt.value) {
          context.report({ node: alt, messageId: 'missingAlt' });
          return;
        }

        if (alt.value.type === 'Literal' && typeof alt.value.value === 'string') {
          const value = alt.value.value.trim();
          if (value.length === 0 && options.enforceMeaningful) {
            context.report({ node: alt, messageId: 'emptyAlt' });
          }
        }
      },
    };
  },
});
