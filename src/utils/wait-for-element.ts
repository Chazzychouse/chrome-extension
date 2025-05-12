// Utility for a Chrome extension that waits for a specific element on the page and calls a callback when it's found.

const getAllElements = (node: Node): Element[] => {
  if (!(node instanceof Element)) {
    return [];
  }
  const nodes = [node];
  if (node.childNodes) {
    nodes.push(...[...node.childNodes].flatMap(getAllElements));
  }
  return nodes;
};

export interface ElementMatcher {
  matchFunction: (node: Element) => boolean;
  description?: string;
}

export interface WaitForElementOptions {
  subtree?: boolean;
  childList?: boolean;
  attributes?: boolean;
  timeout?: number;
  onTimeout?: () => void;
}

export const matchers = {
  byId: (id: string): ElementMatcher => ({
    matchFunction: (node: Element) => node.id === id,
    description: `element with id "${id}"`
  }),
  
  bySelector: (selector: string): ElementMatcher => ({
    matchFunction: (node: Element) => {
      try {
        return node.matches(selector);
      } catch (e) {
        console.error(`Error matching selector "${selector}":`, e);
        return false;
      }
    },
    description: `element matching selector "${selector}"`
  }),
  
  byTagAndClass: (tag: string, className: string): ElementMatcher => ({
    matchFunction: (node: Element) => 
      node.tagName.toLowerCase() === tag.toLowerCase() && 
      node.classList.contains(className),
    description: `${tag} with class "${className}"`
  }),
  
  custom: (matchFn: (node: Element) => boolean, description = 'custom element'): ElementMatcher => ({
    matchFunction: matchFn,
    description
  })
};

export const waitForElement = (
  matcher: ElementMatcher,
  callback: (element: Element) => void,
  options: WaitForElementOptions = { subtree: true, childList: true, attributes: false, timeout: 10000 }
): MutationObserver => {
  let hasElement = false;
  let timeoutId: number | null = null;

  const checkExisting = () => {
    if (document.body) {
      try {
        const existingElements = getAllElements(document.body);
        for (const element of existingElements) {
          if (matcher.matchFunction(element)) {
            hasElement = true;
            callback(element);
            return true;
          }
        }
      } catch (error) {
        console.error('Error checking for existing elements:', error);
      }
    }
    return false;
  };

  if (checkExisting()) {
    return new MutationObserver(() => {});
  }

  const observer = new MutationObserver((records) => {
    try {
      for (const record of records) {
        if (record.type === "childList") {
          if (!hasElement) {
            for (const element of [...record.addedNodes].flatMap(getAllElements)) {
              if (element instanceof Element && matcher.matchFunction(element)) {
                hasElement = true;
                if (timeoutId !== null) {
                  window.clearTimeout(timeoutId);
                  timeoutId = null;
                }
                callback(element);
                return;
              }
            }
          } else {
            for (const element of [...record.removedNodes].flatMap(getAllElements)) {
              if (element instanceof Element && matcher.matchFunction(element)) {
                hasElement = false;
                return;
              }
            }
          }
        } else if (
          record.type === "attributes" &&
          !hasElement &&
          record.target instanceof Element &&
          matcher.matchFunction(record.target)
        ) {
          hasElement = true;
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
          }
          callback(record.target as Element);
          return;
        }
      }
    } catch (error) {
      console.error('Error in mutation observer:', error);
    }
  });

  const startObserving = () => {
    if (document.body) {
      observer.observe(document.body, {
        subtree: options.subtree !== false,
        childList: options.childList !== false,
        attributes: options.attributes === true
      });
      
      if (options.timeout && options.timeout > 0) {
        timeoutId = window.setTimeout(() => {
          observer.disconnect();
          if (options.onTimeout) {
            options.onTimeout();
          }
        }, options.timeout);
      }
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, {
          subtree: options.subtree !== false,
          childList: options.childList !== false,
          attributes: options.attributes === true
        });
        
        if (options.timeout && options.timeout > 0) {
          timeoutId = window.setTimeout(() => {
            observer.disconnect();
            if (options.onTimeout) {
              options.onTimeout();
            }
          }, options.timeout);
        }
      });
    }
  };

  startObserving();
  return observer;
}; 