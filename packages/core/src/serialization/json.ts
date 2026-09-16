import { PlanaDocument, PlanaDocumentSchema } from "../document/document.js";

export function serialize(document: PlanaDocument): string {
  PlanaDocumentSchema.parse(document);
  return JSON.stringify(document);
}

export function serializePretty(document: PlanaDocument): string {
  PlanaDocumentSchema.parse(document);
  return JSON.stringify(document, null, 2);
}

export function deserialize(input: string): PlanaDocument {
  return PlanaDocumentSchema.parse(JSON.parse(input));
}

export function tryDeserialize(
  input: string,
): { ok: true; document: PlanaDocument } | { ok: false; error: unknown } {
  try {
    return { ok: true, document: deserialize(input) };
  } catch (error) {
    return { ok: false, error };
  }
}
