import { FormatNode, VarType } from './types';
import { matchFormat } from './match';

export class TypingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TypingError';
  }
}

function getVarType(value: any): VarType {
  if (typeof value === 'number') {
    // Should not happen if parsing string tokens, but handled for completeness
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
  if (t1 === VarType.Char || t2 === VarType.Char) return VarType.String; // Char + anything else -> String (except maybe Char + Char = Char which is caught by t1==t2)

  const types = new Set([t1, t2]);
  if (types.has(VarType.IndexInt) && types.has(VarType.ValueInt)) return VarType.ValueInt;
  if (types.has(VarType.IndexInt) && types.has(VarType.Float)) return VarType.Float;
  if (types.has(VarType.ValueInt) && types.has(VarType.Float)) return VarType.Float;

  return VarType.String; // Fallback
}

function getVarTypesFromMatchResult(values: Record<string, any>): Record<string, VarType> {
  const types: Record<string, VarType> = {};

  for (const name of Object.keys(values)) {
    const val = values[name];
    let candidateTypes: Set<VarType> = new Set();

    if (typeof val === 'object') {
      // Map/Dictionary of values
      for (const k of Object.keys(val)) {
        candidateTypes.add(getVarType(val[k]));
      }
    } else {
      // Scalar
      candidateTypes.add(getVarType(val));
    }

    if (candidateTypes.size === 0) {
        throw new TypingError(`Failed to infer type: ${name} has no values`);
    }

    // Reduce types
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

  // TODO: Check for IndexInt usage.
  // This requires AST analysis to see if variable is used as index.
  // For now, we rely on value content. Integer values are ValueInt.
  // If we had variable dependency info, we could promote to IndexInt if used as index but not declared as int?
  // Actually, IndexInt is usually *stricter* than ValueInt?
  // In Python code: "used as indices but the type is not an integer" -> Error.
  // And "unify(IndexInt, ValueInt) -> ValueInt".
  // So IndexInt is a subset?
  // Here we just infer based on content.

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

export function inferTypesFromInstances(node: FormatNode, instances: string[]): Record<string, VarType> {
  if (instances.length === 0) return {};

  let finalTypes: Record<string, VarType> | null = null;

  for (const instance of instances) {
    try {
        const values = matchFormat(node, instance);
        const types = getVarTypesFromMatchResult(values);

        if (finalTypes === null) {
            finalTypes = types;
        } else {
            finalTypes = unifyVarTypes(finalTypes, types);
        }
    } catch (e) {
        // If match fails for one instance, we might want to warn and skip, or fail completely.
        // For now, let's log and rethrow or ignore?
        // Python version raises FormatMatchError.
        console.warn(`Failed to match instance: ${e}`);
        throw e;
    }
  }

  return finalTypes || {};
}
