import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/sunnypshah1/accessmate/rules/${name}`);

type MessageIds = 'missingLabel';

function getElementName(node: TSESTree.JSXOpeningElement): string | null {
  if (node.name.type === 'JSXIdentifier') {
    return node.name.name;
  }

  if (node.name.type === 'JSXMemberExpression') {
    return node.name.property.type === 'JSXIdentifier' ? node.name.property.name : null;
  }

  return null;
}

function isInput(node: TSESTree.JSXOpeningElement) {
  return getElementName(node) === 'input';
}

function hasAriaLabel(attributes: TSESTree.JSXAttribute[]) {
  return attributes.some((attr) => attr.type === 'JSXAttribute' && attr.name.name === 'aria-label');
}

function hasAriaLabelledBy(attributes: TSESTree.JSXAttribute[]) {
  return attributes.some((attr) => attr.type === 'JSXAttribute' && attr.name.name === 'aria-labelledby');
}

function getId(attributes: TSESTree.JSXAttribute[]) {
  const idAttr = attributes.find((attr) => attr.type === 'JSXAttribute' && attr.name.name === 'id');
  if (!idAttr || !idAttr.value || idAttr.value.type !== 'Literal') {
    return null;
  }

  const literal = idAttr.value;
  return typeof literal.value === 'string' ? literal.value : null;
}

export const inputLabelRule = createRule<[], MessageIds>({
  name: 'input-label',
  meta: {
    type: 'problem',
      docs: {
        description: 'Inputs must be labelled using <label>, aria-label, or aria-labelledby',
      },
    schema: [],
    messages: {
      missingLabel: 'Associate this input with a label element or add aria-label.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXElement(node) {
        if (node.openingElement.selfClosing && isInput(node.openingElement)) {
          const attributes = node.openingElement.attributes.filter(
            (attr): attr is TSESTree.JSXAttribute => attr.type === 'JSXAttribute',
          );

          const ariaLabelled = hasAriaLabel(attributes) || hasAriaLabelledBy(attributes);
          const id = getId(attributes);
          const hasLabelSibling = id
            ? node.parent &&
              node.parent.type === 'JSXElement' &&
              node.parent.children.some(
                (child) =>
                  child.type === 'JSXElement' &&
                  getElementName(child.openingElement) === 'label' &&
                  child.openingElement.attributes.some(
                    (attr) =>
                      attr.type === 'JSXAttribute' &&
                      attr.name.name === 'htmlFor' &&
                      attr.value &&
                      attr.value.type === 'Literal' &&
                      attr.value.value === id,
                  ),
              )
            : false;

          if (!ariaLabelled && !hasLabelSibling) {
            context.report({ node: node.openingElement, messageId: 'missingLabel' });
          }
        }
      },
    };
  },
});
