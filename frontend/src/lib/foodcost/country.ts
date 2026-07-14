import { useRouterState } from "@tanstack/react-router";
import type { FcCurrency } from "./types";

export type FcCountry = "in" | "us";

export function useFoodcostCountry(): FcCountry | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/foodcost/in")) return "in";
  if (pathname.startsWith("/foodcost/us")) return "us";
  return null;
}

export const COUNTRY_LABEL: Record<FcCountry, string> = { in: "India", us: "USA" };
export const COUNTRY_FLAG: Record<FcCountry, string> = { in: "🇮🇳", us: "🇺🇸" };
export const countryCurrency = (c: FcCountry): FcCurrency => (c === "in" ? "inr" : "usd");
export const countryField = (c: FcCountry): "active_in" | "active_us" =>
  c === "in" ? "active_in" : "active_us";
