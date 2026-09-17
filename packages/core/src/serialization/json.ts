import { PlanaDocument, PlanaDocumentSchema } from "../document/document";

export function serializePretty(document: PlanaDocument): string {
  return JSON.stringify(PlanaDocumentSchema.parse(document), null, 2);
}

export function deserialize(input: string): PlanaDocument {
  return PlanaDocumentSchema.parse(JSON.parse(input));
}
