// Company number rules by country, shared by the registration form (hints)
// and the server (validation). Plain module: no server-only imports.
//
// Sources (docs/PLAN.md, section 8):
// - EU VAT numbers: European Commission, VIES FAQ "VAT identification number
//   structure". Format only: VIES does not publish the check-digit algorithms.
// - US EIN: IRS, nine digits written XX-XXXXXXX. Prefixes are not checked,
//   because the IRS keeps adding new ones.
// - Bulgaria: EIK, 9 or 13 digits. Whether the company exists and is active is
//   checked by the CompanyVerifier in phase 2.

// ISO 3166-1 alpha-2 codes. Names come from Intl.DisplayNames, so they are
// not typed by hand (a test checks that every code has a name).
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

export const DEFAULT_COUNTRY: CountryCode = "BG";

export function isCountryCode(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

export function countryName(code: string, locale = "bg"): string {
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
}

export type CountryOption = { code: CountryCode; name: string };

// Sorted by the Bulgarian name. Built on the server and passed to the form,
// so the server and the browser never disagree on the list.
export function countryOptions(locale = "bg"): CountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}

type EuRule = { pattern: RegExp; hint: string; extra?: (n: string) => boolean };

// The part after the country prefix, as in the VIES table. Greece uses the
// prefix EL, not its ISO code GR.
const EU_VAT: Record<string, EuRule & { prefix: string }> = {
  AT: { prefix: "AT", pattern: /^U\d{8}$/, hint: "ATU и 8 цифри" },
  BE: { prefix: "BE", pattern: /^[01]\d{9}$/, hint: "BE и 10 цифри, започва с 0 или 1" },
  CY: { prefix: "CY", pattern: /^\d{8}[A-Z]$/, hint: "CY, 8 цифри и буква" },
  CZ: { prefix: "CZ", pattern: /^\d{8,10}$/, hint: "CZ и 8, 9 или 10 цифри" },
  DE: { prefix: "DE", pattern: /^\d{9}$/, hint: "DE и 9 цифри" },
  DK: { prefix: "DK", pattern: /^\d{8}$/, hint: "DK и 8 цифри" },
  EE: { prefix: "EE", pattern: /^\d{9}$/, hint: "EE и 9 цифри" },
  GR: { prefix: "EL", pattern: /^\d{9}$/, hint: "EL и 9 цифри" },
  ES: {
    prefix: "ES",
    pattern: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
    // VIES note: the first and last characters may not both be digits.
    extra: (n) => !/^\d.*\d$/.test(n),
    hint: "ES и 9 знака; първият и последният може да са букви, но не и двата цифри",
  },
  FI: { prefix: "FI", pattern: /^\d{8}$/, hint: "FI и 8 цифри" },
  FR: { prefix: "FR", pattern: /^[A-Z0-9]{2}\d{9}$/, hint: "FR, 2 букви или цифри и 9 цифри" },
  HR: { prefix: "HR", pattern: /^\d{11}$/, hint: "HR и 11 цифри" },
  HU: { prefix: "HU", pattern: /^\d{8}$/, hint: "HU и 8 цифри" },
  IE: {
    prefix: "IE",
    pattern: /^(\d[A-Z0-9+*]\d{5}[A-Z]|\d{7}[A-Z]{1,2})$/,
    hint: "IE и 8 или 9 знака",
  },
  IT: { prefix: "IT", pattern: /^\d{11}$/, hint: "IT и 11 цифри" },
  LT: { prefix: "LT", pattern: /^(\d{9}|\d{12})$/, hint: "LT и 9 или 12 цифри" },
  LU: { prefix: "LU", pattern: /^\d{8}$/, hint: "LU и 8 цифри" },
  LV: { prefix: "LV", pattern: /^\d{11}$/, hint: "LV и 11 цифри" },
  MT: { prefix: "MT", pattern: /^\d{8}$/, hint: "MT и 8 цифри" },
  NL: {
    prefix: "NL",
    pattern: /^[A-Z0-9+*]{9}B[A-Z0-9+*]{2}$/,
    hint: "NL и 12 знака, 10-ият е B (например NL123456789B01)",
  },
  PL: { prefix: "PL", pattern: /^\d{10}$/, hint: "PL и 10 цифри" },
  PT: { prefix: "PT", pattern: /^\d{9}$/, hint: "PT и 9 цифри" },
  RO: { prefix: "RO", pattern: /^\d{2,10}$/, hint: "RO и от 2 до 10 цифри" },
  SE: { prefix: "SE", pattern: /^\d{12}$/, hint: "SE и 12 цифри" },
  SI: { prefix: "SI", pattern: /^\d{8}$/, hint: "SI и 8 цифри" },
  SK: { prefix: "SK", pattern: /^\d{10}$/, hint: "SK и 10 цифри" },
};

export type NumberKind = "eik" | "vat" | "ein" | "registration";

export type CompanyNumberRule = {
  kind: NumberKind;
  label: string;
  hint: string;
  maxLength: number;
};

export function ruleFor(country: string): CompanyNumberRule {
  if (country === "BG") {
    return { kind: "eik", label: "ЕИК", hint: "9 или 13 цифри.", maxLength: 15 };
  }
  const eu = EU_VAT[country];
  if (eu) {
    return {
      kind: "vat",
      label: "ДДС номер",
      hint: `${eu.hint}. Кодът на държавата (${eu.prefix}) може да не се въвежда.`,
      maxLength: 20,
    };
  }
  if (country === "US") {
    return {
      kind: "ein",
      label: "EIN (Employer Identification Number)",
      hint: "9 цифри във формат XX-XXXXXXX.",
      maxLength: 10,
    };
  }
  return {
    kind: "registration",
    label: "Регистрационен номер на фирмата",
    hint: "Номерът от търговския регистър на вашата държава: от 2 до 30 букви (латиница) и цифри.",
    maxLength: 40,
  };
}

export type ParseResult = { ok: true; value: string } | { ok: false; message: string };

// Spaces, dots, dashes and slashes are only for readability.
function compact(input: string): string {
  return input.toUpperCase().replace(/[\s.\-/]/g, "");
}

// Tries the number as typed, then without the country prefix, so that both
// "123456789" and "DE123456789" are accepted.
function matchWithOptionalPrefix(
  value: string,
  prefix: string,
  test: (n: string) => boolean,
): string | null {
  if (value.startsWith(prefix) && test(value.slice(prefix.length))) {
    return value.slice(prefix.length);
  }
  return test(value) ? value : null;
}

// Returns the stored form of the number:
// - Bulgaria: the EIK digits;
// - EU: the full VAT number with its prefix (for example DE123456789);
// - US: the nine EIN digits;
// - other countries: letters and digits only, upper case.
export function parseCompanyNumber(country: string, input: string): ParseResult {
  const value = compact(input);
  const rule = ruleFor(country);
  const wrong = { ok: false as const, message: `Невалиден формат. ${rule.hint}` };
  if (value.length === 0) return { ok: false, message: `Въведете ${rule.label}.` };

  switch (rule.kind) {
    case "eik": {
      const eik = matchWithOptionalPrefix(value, "BG", (n) => /^(\d{9}|\d{13})$/.test(n));
      return eik ? { ok: true, value: eik } : wrong;
    }
    case "vat": {
      const eu = EU_VAT[country];
      const body = matchWithOptionalPrefix(
        value,
        eu.prefix,
        (n) => eu.pattern.test(n) && (eu.extra?.(n) ?? true),
      );
      return body ? { ok: true, value: eu.prefix + body } : wrong;
    }
    case "ein":
      return /^\d{9}$/.test(value) ? { ok: true, value } : wrong;
    case "registration":
      return /^[A-Z0-9]{2,30}$/.test(value) ? { ok: true, value } : wrong;
  }
}

// How the stored number is shown to admins.
export function formatCompanyNumber(country: string, value: string): string {
  const rule = ruleFor(country);
  if (rule.kind === "ein" && /^\d{9}$/.test(value)) return `${value.slice(0, 2)}-${value.slice(2)}`;
  return value;
}
