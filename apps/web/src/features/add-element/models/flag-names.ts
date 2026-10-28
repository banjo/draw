// Names the browser doesn't know: parts of countries, and flags that aren't countries
const FLAG_NAMES: Record<string, string> = {
    "gb-ukm": "United Kingdom",
    "gb-eng": "England",
    "gb-nir": "Northern Ireland",
    "gb-sct": "Scotland",
    "gb-wls": "Wales",
    "bq-bo": "Bonaire",
    "bq-sa": "Saba",
    "bq-se": "Sint Eustatius",
};

// Other names people search by
const FLAG_TAGS: Record<string, string[]> = {
    gb: ["uk", "great britain", "england"],
    "gb-ukm": ["uk", "great britain", "england"],
    us: ["usa", "america"],
    nl: ["holland"],
    "european-union": ["eu", "europe"],
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const getRegionName = (code: string) => {
    try {
        return regionNames.of(code.toUpperCase());
    } catch {
        return undefined;
    }
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "se" → "Sweden", "au-nsw" → "Australia (NSW)", "european-union" → "European union" */
export const getFlagName = (code: string) => {
    const known = FLAG_NAMES[code];
    if (known) return known;

    const [country = "", ...part] = code.split("-");
    const region = country.length === 2 ? getRegionName(country) : undefined;
    if (region && part.length === 0) return region;
    if (region) return `${region} (${part.join("-").toUpperCase()})`;

    return capitalize(code.replaceAll("-", " "));
};

export const getFlagTags = (code: string) => FLAG_TAGS[code] ?? [];
