/* Development-only parser. Acorn is not included in the TV application package. */
var acorn = require('./vendor/acorn');
function validate(source, filename) {
  var ast = acorn.parse(source, { ecmaVersion: 5, locations: true });
  function walk(node, parent, owner) {
    if (!node || typeof node.type !== 'string') { return; }
    if (node.type === 'FunctionDeclaration') {
      var topLevel = parent && parent.type === 'Program';
      var functionBody = parent && parent.type === 'BlockStatement' && owner && /^Function/.test(owner.type) && owner.body === parent;
      if (!topLevel && !functionBody) {
        throw new SyntaxError((filename || 'Script') + ':' + node.loc.start.line + ': Block-scoped function declaration is not supported by strict ES5 / Chromium 38');
      }
    }
    Object.keys(node).forEach(function (key) {
      var value = node[key];
      if (Array.isArray(value)) { value.forEach(function (child) { walk(child, node, parent); }); }
      else if (value && typeof value.type === 'string') { walk(value, node, parent); }
    });
  }
  walk(ast, null, null);
}
module.exports = validate;
