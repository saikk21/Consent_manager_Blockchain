export type PolicyState = "DRAFT" | "PUBLISHED" | "DEPRECATED";

export type PolicySection = Readonly<{
  id: string;
  text: string;
}>;

export type PolicyLocaleContent = Readonly<{
  title: string;
  sections: PolicySection[];
}>;

export type PolicyLocales = Readonly<Record<string, PolicyLocaleContent>>;

