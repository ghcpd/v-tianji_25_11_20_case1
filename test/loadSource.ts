import fs from "fs";
import path from "path";
import ts from "typescript";

const DEFAULT_EXPORTS = [
  "RemoteFetcher",
  "Lifecycle",
  "mutateProto",
  "Manager",
  "walker",
  "raceAndUse",
  "dynamicInvoke",
  "normalizeUser"
];

export function loadSourceModule(relativePath: string, exportNames = DEFAULT_EXPORTS) {
  const abs = path.resolve(__dirname, "..", relativePath);
  let source = fs.readFileSync(abs, "utf8");
  source = stripOrchestrate(source);
  const exportClause = `\nexport { ${exportNames.join(", ")} };`;
  source += exportClause;
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019
    }
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  const fn = new Function("exports", "require", "module", "__filename", "__dirname", transpiled);
  fn(module.exports, require, module, abs, path.dirname(abs));
  return module.exports;
}

function stripOrchestrate(source: string) {
  const pattern = /orchestrate\(\)\.catch\(e => \{[\s\S]*?\}\);\s*$/;
  return source.replace(pattern, "");
}
