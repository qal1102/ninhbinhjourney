import { getPackageBySlug } from "@/content/packages";

export type PublicSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const CONTINUITY_FROM_VALUES = [
  "home",
  "catalog",
  "explore",
  "package",
] as const;
export const CONTINUITY_PARENT_VALUES = ["home", "catalog"] as const;

export type ContinuityFrom = (typeof CONTINUITY_FROM_VALUES)[number];
export type ContinuityParent = (typeof CONTINUITY_PARENT_VALUES)[number];

export type ContinuityContext = {
  lang?: "vi" | "en";
  source?: string;
  journey?: string;
  from?: ContinuityFrom;
  package?: string;
  parent?: ContinuityParent;
};

const continuityFrom = new Set<string>(CONTINUITY_FROM_VALUES);
const continuityParent = new Set<string>(CONTINUITY_PARENT_VALUES);
const controlCharacters = /[\u0000-\u001f\u007f]/;

function scalar(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function opaqueValue(value: string | string[] | undefined) {
  const candidate = scalar(value)?.trim();
  if (
    !candidate ||
    candidate.length > 256 ||
    controlCharacters.test(candidate)
  ) {
    return undefined;
  }
  return candidate;
}

function isPackageSlug(value: string | undefined): value is string {
  return Boolean(value && getPackageBySlug(value));
}

/**
 * Read navigation context without ever accepting a path or return URL.
 * `source` and `journey` are opaque state that is URL-encoded on output;
 * hierarchy is represented only by the three allow-listed fields below.
 */
export function readContinuityContext(
  query: PublicSearchParams,
): ContinuityContext {
  const lang = scalar(query.lang);
  const from = scalar(query.from);
  const packageSlug = scalar(query.package);
  const parent = scalar(query.parent);

  return {
    ...(lang === "vi" || lang === "en" ? { lang } : {}),
    ...(opaqueValue(query.source) ? { source: opaqueValue(query.source) } : {}),
    ...(opaqueValue(query.journey)
      ? { journey: opaqueValue(query.journey) }
      : {}),
    ...(from && continuityFrom.has(from)
      ? { from: from as ContinuityFrom }
      : {}),
    ...(isPackageSlug(packageSlug) ? { package: packageSlug } : {}),
    ...(parent && continuityParent.has(parent)
      ? { parent: parent as ContinuityParent }
      : {}),
  };
}

type ContextOverrides = Partial<ContinuityContext>;

function safePackageSlug(slug: string) {
  if (!isPackageSlug(slug)) {
    throw new Error(`Unknown package slug: ${slug}`);
  }
  return slug;
}

function safeDestinationSlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Unsafe destination slug: ${slug}`);
  }
  return slug;
}

function safeDestinationId(id: string) {
  if (!/^[a-z0-9-]{1,80}$/i.test(id)) {
    throw new Error(`Unsafe destination id: ${id}`);
  }
  return id;
}

function appendContext(
  params: URLSearchParams,
  context: ContinuityContext,
) {
  if (context.lang) params.set("lang", context.lang);
  if (context.source) params.set("source", context.source);
  if (context.journey) params.set("journey", context.journey);
  if (context.from && continuityFrom.has(context.from)) {
    params.set("from", context.from);
  }
  if (isPackageSlug(context.package)) params.set("package", context.package);
  if (context.parent && continuityParent.has(context.parent)) {
    params.set("parent", context.parent);
  }
}

export function withContinuityContext(
  pathname: string,
  context: ContinuityContext,
  overrides: ContextOverrides = {},
  hash?: string,
) {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    throw new Error("Continuity destinations must be same-origin paths");
  }
  const params = new URLSearchParams();
  appendContext(params, { ...context, ...overrides });
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

export function packageDetailHref(
  slug: string,
  context: ContinuityContext,
  from: "home" | "catalog",
) {
  return withContinuityContext(
    `/packages/${safePackageSlug(slug)}`,
    context,
    { from, package: undefined, parent: undefined },
  );
}

export function packageCatalogHref(
  context: ContinuityContext,
  from?: "home",
) {
  return withContinuityContext("/packages", context, {
    from,
    package: undefined,
    parent: undefined,
  });
}

export function packageCatalogBackHref(context: ContinuityContext) {
  if (context.from === "home") {
    return withContinuityContext(
      "/",
      context,
      { from: undefined, package: undefined, parent: undefined },
      "packages",
    );
  }
  if (context.journey) {
    return withContinuityContext(
      `/journey/${encodeURIComponent(context.journey)}`,
      { lang: context.lang, source: context.source },
    );
  }
  return withContinuityContext("/plan", {
    lang: context.lang,
    source: context.source,
  });
}

export function packageDetailBackHref(context: ContinuityContext) {
  if (context.from === "home") {
    return withContinuityContext(
      "/",
      context,
      { from: undefined, package: undefined, parent: undefined },
      "packages",
    );
  }
  return withContinuityContext("/packages", context, {
    from: undefined,
    package: undefined,
    parent: undefined,
  });
}

export function destinationFromPackageHref(
  destinationSlug: string,
  packageSlug: string,
  context: ContinuityContext,
) {
  const parent: ContinuityParent =
    context.from === "home" ? "home" : "catalog";
  return withContinuityContext(
    `/destination/${safeDestinationSlug(destinationSlug)}`,
    context,
    {
      from: "package",
      package: safePackageSlug(packageSlug),
      parent,
    },
  );
}

export function destinationFromExploreHref(
  destinationSlug: string,
  context: ContinuityContext,
) {
  return withContinuityContext(
    `/destination/${safeDestinationSlug(destinationSlug)}`,
    context,
    { from: "explore", package: undefined, parent: undefined },
  );
}

export function destinationFromHomeHref(
  destinationSlug: string,
  context: ContinuityContext,
) {
  return withContinuityContext(
    `/destination/${safeDestinationSlug(destinationSlug)}`,
    context,
    { from: "home", package: undefined, parent: undefined },
  );
}

export function destinationBackHref(context: ContinuityContext) {
  if (context.from === "package" && isPackageSlug(context.package)) {
    return packageDetailHref(
      context.package,
      context,
      context.parent === "home" ? "home" : "catalog",
    );
  }
  if (context.from === "home") {
    return withContinuityContext(
      "/",
      context,
      { from: undefined, package: undefined, parent: undefined },
      "all-destinations",
    );
  }
  return withContinuityContext("/explore", context, {
    from: undefined,
    package: undefined,
    parent: undefined,
  });
}

export function destinationRelatedHref(
  destinationSlug: string,
  context: ContinuityContext,
) {
  return withContinuityContext(
    `/destination/${safeDestinationSlug(destinationSlug)}`,
    context,
  );
}

export function planDestinationHref(
  action: "add" | "replace" | "remove",
  destinationId: string,
  context: ContinuityContext,
) {
  const base = withContinuityContext("/plan", context, {
    from: undefined,
    package: undefined,
    parent: undefined,
  });
  return `${base}${base.includes("?") ? "&" : "?"}${action}=${encodeURIComponent(
    safeDestinationId(destinationId),
  )}`;
}

export function checkoutHref(
  packageSlug: string,
  context: ContinuityContext,
) {
  return withContinuityContext("/checkout", context, {
    from: undefined,
    package: safePackageSlug(packageSlug),
    parent: undefined,
  });
}

export function packageImageTransitionName(slug: string) {
  return `package-image-${safePackageSlug(slug)}`;
}

export function destinationImageTransitionName(slug: string) {
  return `destination-image-${safeDestinationSlug(slug)}`;
}
