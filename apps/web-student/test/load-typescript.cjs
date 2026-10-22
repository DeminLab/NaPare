const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTypeScript(file) {
  const absolute = path.resolve(file);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const localRequire = name => name.startsWith('.') ? loadTypeScript(path.resolve(path.dirname(absolute), `${name}.ts`)) : require(name);
  vm.runInNewContext(code, { exports, require: localRequire, Response, atob, URL, console }, { filename: absolute });
  return exports;
}
module.exports = { loadTypeScript };
