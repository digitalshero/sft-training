import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

export type CountryScope = "global" | "IN" | "US";
export type LanguageScope = "all" | "en" | "ta" | "te" | "hi" | "ml" | "kn" | "bn" | "es";

export const COUNTRY_LABEL: Record<CountryScope, string> = {
  global: "Global",
  IN: "India",
  US: "USA",
};

export const LANGUAGE_LABEL: Record<LanguageScope, string> = {
  all: "All languages",
  en: "English",
  ta: "Tamil",
  te: "Telugu",
  hi: "Hindi",
  ml: "Malayalam",
  kn: "Kannada",
  bn: "Bengali",
  es: "Spanish",
};

type Scope = { country: CountryScope; language: LanguageScope };

const KEY = "shero.scope";

function read(): Scope {
  if (typeof window === "undefined") return { country: "global", language: "all" };
  try {
    const v = JSON.parse(window.sessionStorage.getItem(KEY) || "{}");
    return {
      country: (v.country as CountryScope) || "global",
      language: (v.language as LanguageScope) || "all",
    };
  } catch {
    return { country: "global", language: "all" };
  }
}

export function useScopeFilter() {
  const [scope, setScope] = useState<Scope>({ country: "global", language: "all" });
  useEffect(() => {
    setScope(read());
  }, []);
  function set(next: Partial<Scope>) {
    const merged = { ...scope, ...next };
    setScope(merged);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(KEY, JSON.stringify(merged));
    }
  }
  return { scope, setScope: set };
}

export function ScopeFilter({
  scope,
  onChange,
  compact,
}: {
  scope: Scope;
  onChange: (next: Partial<Scope>) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${compact ? "" : "rounded-lg border border-border bg-card p-2"}`}
    >
      <Tabs value={scope.country} onValueChange={(v) => onChange({ country: v as CountryScope })}>
        <TabsList className="h-8">
          {(Object.keys(COUNTRY_LABEL) as CountryScope[]).map((c) => (
            <TabsTrigger key={c} value={c} className="h-6 px-2 text-xs">
              {COUNTRY_LABEL[c]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Select
        value={scope.language}
        onValueChange={(v) => onChange({ language: v as LanguageScope })}
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <Globe className="mr-1 h-3.5 w-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(LANGUAGE_LABEL) as LanguageScope[]).map((l) => (
            <SelectItem key={l} value={l} className="text-xs">
              {LANGUAGE_LABEL[l]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Apply scope to a Supabase query builder. Pass column overrides per table. */
export function applyScope<T extends { eq: (col: string, val: unknown) => T }>(
  qb: T,
  scope: Scope,
  cols: { country?: string; language?: string } = { country: "country", language: "language" },
): T {
  let out = qb;
  if (scope.country !== "global" && cols.country) {
    out = out.eq(cols.country, scope.country);
  }
  if (scope.language !== "all" && cols.language) {
    out = out.eq(cols.language, scope.language);
  }
  return out;
}
