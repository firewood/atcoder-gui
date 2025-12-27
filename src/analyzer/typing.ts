import { FormatNode, VarType, ASTNode, LoopNode, ItemNode } from './types.js';
import { matchFormat } from './match.js';

export class TypingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TypingError';
  }
}

function getVarType(value: any): VarType {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? VarType.ValueInt : VarType.Float;
  }
  if (typeof value === 'string') {
    if (/^-?\d+$/.test(value)) {
      return VarType.ValueInt;
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return VarType.Float;
    }
    if (value.length === 1) {
      return VarType.Char;
    }
    return VarType.String;
  }
  throw new TypingError(`Unknown value type: ${value}`);
}

function unifyTypes(t1: VarType, t2: VarType): VarType {
  if (t1 === t2) return t1;

  if (t1 === VarType.String || t2 === VarType.String) return VarType.String;
  if (t1 === VarType.Char || t2 === VarType.Char) return VarType.String;

  const types = new Set([t1, t2]);
  if (types.has(VarType.IndexInt) && types.has(VarType.ValueInt)) return VarType.ValueInt;
  if (types.has(VarType.IndexInt) && types.has(VarType.Float)) return VarType.Float;
  if (types.has(VarType.ValueInt) && types.has(VarType.Float)) return VarType.Float;

  return VarType.String;
}

function getVarTypesFromMatchResult(values: Record<string, any>): Record<string, VarType> {
  const types: Record<string, VarType> = {};

  for (const name of Object.keys(values)) {
    const val = values[name];
    let candidateTypes: Set<VarType> = new Set();

    if (typeof val === 'object') {
      for (const k of Object.keys(val)) {
        candidateTypes.add(getVarType(val[k]));
      }
    } else {
      candidateTypes.add(getVarType(val));
    }

    if (candidateTypes.size === 0) {
        throw new TypingError(`Failed to infer type: ${name} has no values`);
    }

    let currentType: VarType | null = null;
    for (const t of candidateTypes) {
        if (currentType === null) {
            currentType = t;
        } else {
            currentType = unifyTypes(currentType, t);
        }
    }
    if (currentType) {
        types[name] = currentType;
    }
  }

  return types;
}

function unifyVarTypes(t1: Record<string, VarType>, t2: Record<string, VarType>): Record<string, VarType> {
  const t3: Record<string, VarType> = {};
  const allKeys = new Set([...Object.keys(t1), ...Object.keys(t2)]);

  for (const name of allKeys) {
    if (t1[name] && t2[name]) {
      t3[name] = unifyTypes(t1[name], t2[name]);
    } else if (t1[name]) {
      t3[name] = t1[name];
    } else {
      t3[name] = t2[name];
    }
  }
  return t3;
}

function collapseLoops(node: ASTNode): { collapsedAst: ASTNode; collapsedVars: Set<string> } {
  const collapsedVars = new Set<string>();

  function transform(n: ASTNode): ASTNode {
    if (n.type === 'format') {
      const fmt = n as FormatNode;
      return { ...fmt, children: fmt.children.map(transform) };
    }
    if (n.type === 'loop') {
      const loop = n as LoopNode;
      // Check if collapsible
      // Condition: body contains exactly one ItemNode, possibly nested in FormatNodes
      let item: ItemNode | null = null;
      let isSimple = true;

      const checkBody = (nodes: ASTNode[]) => {
        for (const child of nodes) {
          if (child.type === 'format') {
            checkBody((child as FormatNode).children);
          } else if (child.type === 'item') {
            if (item) {
              isSimple = false; // More than one item
            } else {
              item = child as ItemNode;
            }
          } else if (child.type === 'break' || child.type === 'dots') {
             // Ignore break/dots
          } else {
             isSimple = false; // Other nodes like nested loops or binops
          }
        }
      };

      checkBody(loop.body);

      if (isSimple && item) {
        const originalItem = item as ItemNode;
        // Find index that uses the loop variable
        const loopVar = loop.variable;
        const indexToRemove = originalItem.indices.findIndex(idx =>
            idx.type === 'item' && (idx as ItemNode).name === loopVar
        );

        if (indexToRemove !== -1) {
            // Collapsible!
            const newIndices = [...originalItem.indices];
            newIndices.splice(indexToRemove, 1);

            collapsedVars.add(originalItem.name);
            return {
              ...originalItem,
              indices: newIndices,
            };
        }
      }

      // If not collapsible, recurse
      return {
        ...loop,
        body: loop.body.map(transform),
      };
    }
    return n;
  }

  const collapsedAst = transform(node);
  return { collapsedAst, collapsedVars };
}

export function inferTypesFromInstances(
    node: FormatNode,
    instances: string[]
): { types: Record<string, VarType>; collapsedVars: Set<string> } {
  if (instances.length === 0) return { types: {}, collapsedVars: new Set() };

  let firstError: any;
  try {
      let finalTypes: Record<string, VarType> | null = null;
      for (const instance of instances) {
          const values = matchFormat(node, instance);
          const types = getVarTypesFromMatchResult(values);
          finalTypes = finalTypes ? unifyVarTypes(finalTypes, types) : types;
      }
      return { types: finalTypes || {}, collapsedVars: new Set() };
  } catch (e) {
      firstError = e;
  }

  const { collapsedAst, collapsedVars } = collapseLoops(node);
  if (collapsedVars.size > 0) {
       try {
          let finalTypes: Record<string, VarType> | null = null;
          for (const instance of instances) {
              const values = matchFormat(collapsedAst as FormatNode, instance);
              const types = getVarTypesFromMatchResult(values);
              finalTypes = finalTypes ? unifyVarTypes(finalTypes, types) : types;
          }
          return { types: finalTypes || {}, collapsedVars };
      } catch (_e) {
          // Both failed. Throw the FIRST error usually.
          throw firstError;
      }
  }

  throw firstError;
}
