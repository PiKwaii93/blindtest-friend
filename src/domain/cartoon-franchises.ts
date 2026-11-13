import catalogue from "../../catalogue/cartoon-franchises.json";

const index = new Map(
  catalogue.groups.flatMap((group) =>
    group.versions.map(
      (version) => [version.editorialId, { group, version }] as const,
    ),
  ),
);
export function cartoonFranchise(editorialId: string | undefined) {
  return editorialId ? index.get(editorialId) : undefined;
}
