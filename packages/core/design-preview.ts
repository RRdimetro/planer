export type HomeConcept = "A" | "B" | "C";

/** Preview routing is process metadata; it never changes the database schema. */
export function designPreview(
  isDemo: boolean,
  concept: string | undefined,
  empty: boolean,
) {
  if (concept && !["A", "B", "C"].includes(concept))
    throw Error("Неизвестная концепция: используйте A, B или C");
  if (concept && !isDemo)
    throw Error("Концепции Forest Noir доступны только в отдельной демо-базе");
  const homeConcept = concept as HomeConcept | undefined;
  return {
    homeConcept,
    empty: isDemo && !!homeConcept && empty,
    directory: homeConcept
      ? `FOCUS OS PRO Forest Noir V4 ${homeConcept}${empty ? " Empty" : ""}`
      : isDemo
        ? "FOCUS OS PRO Design Preview 0.2"
        : "FOCUS OS PRO",
  };
}
