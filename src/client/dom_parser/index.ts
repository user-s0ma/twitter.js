export type HTMLElementRepresentation = {
  tag: string;
  attributes: Record<string, string>;
  content: string;
  children: HTMLElementRepresentation[];
  full: string;
  getAttribute(attrName: string): string | null;
  querySelector(selector: string): HTMLElementRepresentation | null;
  querySelectorAll(selector: string): HTMLElementRepresentation[];
};

export default class JSDOMParser {
  public root: HTMLElementRepresentation;

  constructor(html: string) {
    this.root = this.parseHTML(html);
  }

  private parseHTML(html: string): HTMLElementRepresentation {
    const cleanHtml = html.replace(/^\s*<!DOCTYPE[^>]*>/i, "");

    const rootElement: HTMLElementRepresentation = {
      tag: "root",
      attributes: {},
      content: "",
      children: [],
      full: html,
      getAttribute(attrName: string): string | null {
        return this.attributes[attrName] || null;
      },
      querySelector(selector: string): HTMLElementRepresentation | null {
        const match = JSDOMParser.prototype.parseSelector(selector);
        const results: HTMLElementRepresentation[] = [];

        const traverse = (el: HTMLElementRepresentation): void => {
          if (match(el)) {
            results.push(el);
            return;
          }
          el.children.forEach(traverse);
        };

        traverse(this);
        return results[0] || null;
      },
      querySelectorAll(selector: string): HTMLElementRepresentation[] {
        const match = JSDOMParser.prototype.parseSelector(selector);
        const results: HTMLElementRepresentation[] = [];

        const traverse = (el: HTMLElementRepresentation): void => {
          if (match(el)) {
            results.push(el);
          }
          el.children.forEach(traverse);
        };

        traverse(this);
        return results;
      }
    };

    const withoutComments = cleanHtml.replace(/<!--[\s\S]*?-->/g, "");

    const elementRegex = /<([a-zA-Z0-9-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9-]+)([^>]*?)\s*\/?>/g;
    const attrRegex = /([a-zA-Z0-9-]+)(?:=["']([^"']*)["'])?/g;

    let match;
    while ((match = elementRegex.exec(withoutComments)) !== null) {
      const [fullMatch, tag1, attrs1, content, tag2, attrs2] = match;
      const tag = tag1 || tag2;
      const attrs = attrs1 || attrs2 || "";

      const attributes: Record<string, string> = {};
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        const [_, name, value] = attrMatch;
        attributes[name] = value || "";
      }

      const element: HTMLElementRepresentation = {
        tag,
        attributes,
        content,
        children: [],
        full: fullMatch,
        getAttribute(attrName: string): string | null {
          return this.attributes[attrName] || null;
        },
        querySelector(selector: string): HTMLElementRepresentation | null {
          const match = JSDOMParser.prototype.parseSelector(selector);
          const results: HTMLElementRepresentation[] = [];

          const traverse = (el: HTMLElementRepresentation): void => {
            if (match(el)) {
              results.push(el);
              return;
            }
            el.children.forEach(traverse);
          };

          traverse(this);
          return results[0] || null;
        },
        querySelectorAll(selector: string): HTMLElementRepresentation[] {
          const match = JSDOMParser.prototype.parseSelector(selector);
          const results: HTMLElementRepresentation[] = [];

          const traverse = (el: HTMLElementRepresentation): void => {
            if (match(el)) {
              results.push(el);
            }
            el.children.forEach(traverse);
          };

          traverse(this);
          return results;
        }
      };

      if (content) {
        try {
          const childParser = new JSDOMParser(content);
          element.children = childParser.root.children;
        } catch (e) {
          element.children = [];
        }
      }

      rootElement.children.push(element);
    }

    if (rootElement.children.length === 0) {
      throw new Error("Failed to parse HTML.");
    }

    return rootElement;
  }

  private parseSelector(selector: string): (el: HTMLElementRepresentation) => boolean {
    const selectorParts = selector.match(/^([a-zA-Z0-9*-]+)(?:\[([^\]]+)\])?$/);
    if (!selectorParts) {
      return () => false;
    }

    const tagName = selectorParts[1];
    const attributeSelector = selectorParts[2];

    let attrName: string | null = null;
    let attrOperator: string | null = null;
    let attrValue: string | null = null;

    if (attributeSelector) {
      const attrMatch = attributeSelector.match(/([a-zA-Z0-9-]+)\s*(\^?=)\s*['"]([^'"]*)['"]/);
      if (attrMatch) {
        attrName = attrMatch[1];
        attrOperator = attrMatch[2];
        attrValue = attrMatch[3];
      }
    }

    return (element: HTMLElementRepresentation): boolean => {
      if (tagName !== "*" && element.tag.toLowerCase() !== tagName.toLowerCase()) {
        return false;
      }

      if (attrName && attrValue) {
        const elementAttrValue = element.getAttribute(attrName);
        if (!elementAttrValue) return false;

        return attrOperator === "^=" ? 
          elementAttrValue.startsWith(attrValue) : 
          elementAttrValue === attrValue;
      }

      return true;
    };
  }

  querySelector(selector: string): HTMLElementRepresentation | null {
    return this.root.querySelector(selector);
  }

  querySelectorAll(selector: string): HTMLElementRepresentation[] {
    return this.root.querySelectorAll(selector);
  }
}