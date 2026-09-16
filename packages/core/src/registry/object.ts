import type { PlanaObject } from "../object/object.js";

export type ObjectDefinition = {
  type: string;
  create?: (...args: never[]) => PlanaObject;
  validate?: (object: PlanaObject) => boolean;
};

export class ObjectRegistry {
  private definitions = new Map<string, ObjectDefinition>();

  register(definition: ObjectDefinition) {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Object type "${definition.type}" is already registered`);
    }
    this.definitions.set(definition.type, definition);
  }

  unregister(type: string) {
    this.definitions.delete(type);
  }

  has(type: string) {
    return this.definitions.has(type);
  }

  get(type: string) {
    return this.definitions.get(type);
  }

  require(type: string) {
    const definition = this.definitions.get(type);
    if (!definition) throw new Error(`Unknown object type "${type}"`);
    return definition;
  }

  list() {
    return [...this.definitions.values()];
  }

  clear() {
    this.definitions.clear();
  }
}

export const defaultObjectRegistry = new ObjectRegistry();
