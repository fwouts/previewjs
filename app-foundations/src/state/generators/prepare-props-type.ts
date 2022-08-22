import {
  CollectedTypes,
  objectType,
  optionalType,
  ValueType,
} from "@previewjs/type-analyzer";

export function preparePropsType(
  name: string,
  type: ValueType,
  collected: CollectedTypes
): {
  propsTypeName: string;
  types: CollectedTypes;
} {
  // We need to find the object type and make each of its function properties optional,
  // as we provide a default value for it.
  const types = { ...collected };
  let rootTypeName: string;
  if (type.kind === "name") {
    rootTypeName = type.name;
  } else {
    rootTypeName = `:${name}Props`;
    types[rootTypeName] = { type, parameters: {} };
  }

  let actualObjectTypeName = rootTypeName;
  const previousTypeNames = new Set(rootTypeName);
  while (true) {
    const type = types[actualObjectTypeName]?.type;
    if (type?.kind === "name") {
      if (previousTypeNames.has(type.name)) {
        // Self-referential type. Break the infinite loop.
        break;
      }
      previousTypeNames.add(type.name);
      actualObjectTypeName = type.name;
    } else {
      break;
    }
  }
  const propsType = types[actualObjectTypeName];
  if (propsType?.type.kind === "object") {
    // Make properties optional.
    types[actualObjectTypeName] = {
      type: objectType(
        Object.fromEntries(
          Object.entries(propsType.type.fields).map(
            ([fieldName, fieldType]) => {
              if (fieldType.kind === "function") {
                fieldType = optionalType(fieldType);
              }
              return [fieldName, fieldType];
            }
          )
        )
      ),
      parameters: propsType.parameters,
    };
  }

  return {
    propsTypeName: rootTypeName,
    types,
  };
}
