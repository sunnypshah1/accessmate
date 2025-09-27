import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/sunnypshah1/accessmate/rules/${name}`);

type MessageIds = 'missingType';

function getElementName(node: TSESTree.JSXOpeningElement): string | null {
  if (node.name.type === 'JSXIdentifier') {
    return node.name.name;
  }

  if (node.name.type === 'JSXMemberExpression') {
    return node.name.property.type === 'JSXIdentifier' ? node.name.property.name : null;
  }

  return null;
}

function isButton(node: TSESTree.JSXOpeningElement) {
  return getElementName(node) === 'button';
}

export const buttonTypeRule = createRule<[], MessageIds>({
  name: 'button-type',
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure <button> elements declare an explicit type attribute',
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingType: 'Add type="button" to avoid implicit submit behaviour.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (!isButton(node)) {
          return;
        }

        const hasType = node.attributes.some(
          (attr) => attr.type === 'JSXAttribute' && attr.name.name === 'type',
        );

        if (!hasType) {
          const insertionPoint = node.range![1] - 1;
          context.report({
            node,
            messageId: 'missingType',
            fix(fixer) {
              return fixer.insertTextBeforeRange([insertionPoint, insertionPoint], ' type="button"');
            },
          });
        }
      },
    };
  },
});
