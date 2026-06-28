import type { SourceFile, Node } from "ts-morph";

/**
 * A normalized import record extracted from a source file.
 */
export interface ImportRecord {
  /** The raw import specifier (e.g. "@/domain/foo", "./bar") */
  specifier: string;
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
  /** Whether this is a dynamic import() call */
  isDynamic: boolean;
  /** Whether this is a re-export (export { x } from '...') */
  isReExport: boolean;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
}

/**
 * Extract all imports from a source file.
 *
 * REQ-ANL-002: extract static imports, dynamic import(...) with literal arg,
 * import type, and re-exports.
 *
 * @param sourceFile — ts-morph SourceFile to analyze
 * @returns array of ImportRecord
 */
export function extractImports(sourceFile: SourceFile): ImportRecord[] {
  const records: ImportRecord[] = [];

  // Static imports: import x from '...'  /  import { x } from '...'  /  import type { x } from '...'
  for (const decl of sourceFile.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (!specifier) continue;

    const isTypeOnly = decl.isTypeOnly();
    const start = decl.getStart();
    const { line, column } = sourceFile.getLineAndColumnAtPos(start);

    records.push({
      specifier,
      isTypeOnly,
      isDynamic: false,
      isReExport: false,
      line,
      column,
    });
  }

  // Re-exports: export { x } from '...'  /  export type { x } from '...'  /  export * from '...'
  for (const decl of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = decl.getModuleSpecifier();
    if (!moduleSpecifier) continue;

    const specifier = moduleSpecifier.getLiteralValue();
    if (!specifier) continue;

    const isTypeOnly = decl.isTypeOnly();
    const start = decl.getStart();
    const { line, column } = sourceFile.getLineAndColumnAtPos(start);

    records.push({
      specifier,
      isTypeOnly,
      isDynamic: false,
      isReExport: true,
      line,
      column,
    });
  }

  // Dynamic imports: import('...')
  // Walk the AST to find call expressions named "import"
  visitNodes(sourceFile, (node) => {
    if (node.getKindName() !== "CallExpression") return;

    const children = node.getChildren();
    if (children.length < 2) return;

    const expression = children[0];
    if (expression.getKindName() !== "ImportKeyword") return;

    // Find the parenthesized argument list
    const argList = children.find((c) => c.getKindName() === "SyntaxList");
    if (!argList) return;

    const arg = argList.getChildren()[0];
    if (!arg || arg.getKindName() !== "StringLiteral") return;

    // Strip quotes from the literal text
    const specifier = arg.getText().replace(/^["']|["']$/g, "");

    const start = node.getStart();
    const { line, column } = sourceFile.getLineAndColumnAtPos(start);

    records.push({
      specifier,
      isTypeOnly: false,
      isDynamic: true,
      isReExport: false,
      line,
      column,
    });
  });

  return records;
}

/**
 * Recursively visit all nodes in a source file.
 */
function visitNodes(node: Node, visitor: (node: Node) => void): void {
  visitor(node);
  for (const child of node.getChildren()) {
    visitNodes(child, visitor);
  }
}
