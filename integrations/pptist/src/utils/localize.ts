import type { TranslationEntry } from '@/locales/en';
import { phraseTranslations, wordTranslations } from '@/locales/en';
import { autoTranslations } from '@/locales/generated';

type TranslationMap = Map<string, string>;

const BLOCKED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
const ATTRIBUTE_TARGETS = ['title', 'aria-label', 'placeholder', 'data-title', 'data-tooltip'];

const createWordRegex = () => {
  const entries = wordTranslations.filter(({ zh }) => zh && zh.length > 0);
  const lookup: TranslationMap = new Map(entries.map((entry) => [entry.zh, entry.en]));
  const pattern = entries.map(({ zh }) => zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = pattern ? new RegExp(pattern, 'g') : null;
  return { regex, lookup };
};

const ALL_PHRASES: TranslationEntry[] = [...phraseTranslations, ...autoTranslations];

const { ordered: orderedPhrases, lookup: phraseMap } = (() => {
  const ordered = [...ALL_PHRASES].sort((a, b) => b.zh.length - a.zh.length);
  const map = new Map(ordered.map(({ zh, en }) => [zh, en]));
  return { ordered, lookup: map };
})();
const { regex: wordRegex, lookup: wordMap } = createWordRegex();

const translateString = (input: string): string => {
  if (!input || !/[^\x00-\x7F]/.test(input)) return input;
  let output = input;

  orderedPhrases.forEach(({ zh, en }) => {
    if (output.includes(zh)) {
      output = output.split(zh).join(en);
    }
  });

  if (wordRegex) {
    output = output.replace(wordRegex, (match) => wordMap.get(match) ?? match);
  }

  return output;
};

const translateTextNode = (node: Text) => {
  if (!node.nodeValue) return;
  const translated = translateString(node.nodeValue);
  if (translated !== node.nodeValue) {
    node.nodeValue = translated;
  }
};

const translateAttributes = (element: Element) => {
  ATTRIBUTE_TARGETS.forEach((attr) => {
    const value = element.getAttribute(attr);
    if (!value) return;
    const translated = translateString(value);
    if (translated !== value) {
      element.setAttribute(attr, translated);
    }
  });
};

const translateNode = (node: Node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    translateTextNode(node as Text);
    return;
  }

  if (node instanceof Element && !BLOCKED_TAGS.has(node.tagName)) {
    translateAttributes(node);
  }
};

const translateTree = (root: Node) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (parent && BLOCKED_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    translateTextNode(current as Text);
    current = walker.nextNode();
  }

  const elements: Element[] = (() => {
    if (root instanceof Element) {
      return [root, ...Array.from(root.querySelectorAll('*'))];
    }
    if (root instanceof Document || root instanceof DocumentFragment) {
      return Array.from(root.querySelectorAll('*'));
    }
    return [];
  })();

  elements.forEach((el) => {
    if (!BLOCKED_TAGS.has(el.tagName)) translateAttributes(el);
  });
};

const initLocalization = () => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = 'en';
  translateTree(document.body);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => translateTree(node));
      } else if (mutation.type === 'characterData') {
        translateTextNode(mutation.target as Text);
      } else if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        translateAttributes(mutation.target);
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTE_TARGETS,
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLocalization);
} else {
  initLocalization();
}
