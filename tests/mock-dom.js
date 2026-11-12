// Lightweight DOM mock for verifying SVG generation without 8-second jsdom startup
function createMockDocument() {
  function createNode(ns, tag) {
    const attrs = {};
    const children = [];
    return {
      nodeType: 1,
      namespaceURI: ns,
      tagName: tag,
      style: {},
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k]; },
      appendChild(c) { children.push(c); return c; },
      get children() { return children; },
      get innerHTML() { throw new Error("SecurityError: Setting innerHTML violates Trusted Types CSP!"); },
      set innerHTML(val) { throw new Error("SecurityError: Setting innerHTML violates Trusted Types CSP!"); }
    };
  }

  return {
    createElementNS(ns, tag) { return createNode(ns, tag); },
    createElement(tag) { return createNode(null, tag); }
  };
}

module.exports = { createMockDocument };
