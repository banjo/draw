export const ICON_SET_IDS = [
    "logos",
    "skill-icons",
    "vscode-icons",
    "noto",
    "flagpack",
    "circle-flags",
    "carbon",
    "tabler",
    "fluent-color",
] as const;
export type IconSetId = (typeof ICON_SET_IDS)[number];

export type IconSet = {
    id: IconSetId;
    label: string;
    /** Shown when browsing the sets */
    description: string;
    /** Other words that find the set, besides its label */
    tags: string[];
    /** The icon that stands for the set */
    sample: string;
    /** Drawn in one color, which the palette lightens in dark mode */
    monochrome: boolean;
    /**
     * The names are country codes. They're shown by country name and searched here, as
     * Iconify's search doesn't know the countries.
     */
    countryCodes: boolean;
    /** Shown first, and before the whole set has loaded */
    popular: string[];
    /** The categories first in this order, then the rest as Iconify has them */
    categoryOrder?: string[];
    /** One of each icon, when the set has several of it, like sizes */
    pickNames?: (names: string[]) => string[];
    /** The name as shown, before dashes become spaces */
    displayName?: (name: string) => string;
};

/** The icons in a set, from Iconify, grouped by category when the set has them */
export type IconCollection = {
    names: string[];
    categories: { title: string; names: string[] }[];
};

const words = (text: string) => text.trim().split(/\s+/);

/** "react-dark" and "react-light" are one icon on a dark or light badge: keeps the dark */
const pickDarkVariant = (names: string[]) => {
    const all = new Set(names);
    return names.filter(
        name => !(name.endsWith("-light") && all.has(name.replace(/-light$/, "-dark")))
    );
};

/** "cloud-16" to "cloud-48" are one icon in sizes: keeps the largest */
const pickLargestSize = (names: string[]) => {
    const largest = new Map<string, { name: string; size: number }>();
    for (const name of names) {
        const [, base = name, size = "0"] = /^(.*)-(\d+)$/.exec(name) ?? [];
        const current = largest.get(base);
        if (!current || Number(size) > current.size)
            largest.set(base, { name, size: Number(size) });
    }
    const kept = new Set([...largest.values()].map(({ name }) => name));
    return names.filter(name => kept.has(name));
};

/** "file-type-typescript" → "typescript-file", "folder-type-src" → "src-folder" */
const fileDisplayName = (name: string) =>
    name
        .replace(/^default-/, "")
        .replace(/^file-type-(.*)$/, "$1-file")
        .replace(/^folder-type-(.*)$/, "$1-folder");

export const ICON_SETS: IconSet[] = [
    {
        id: "logos",
        label: "Logos",
        description: "Brands, languages and tools, in their colors",
        tags: ["logo", "brand"],
        sample: "react",
        monochrome: false,
        countryCodes: false,
        popular: words(`
            react typescript-icon javascript nodejs-icon docker-icon kubernetes aws google-cloud
            microsoft-azure github-icon postgresql mysql-icon mongodb-icon redis graphql python
            java go rust figma vue angular-icon svelte-icon nextjs-icon vercel-icon
            cloudflare-icon slack-icon stripe firebase supabase-icon
        `),
    },
    {
        id: "skill-icons",
        label: "Tech stack",
        description: "Languages, frameworks and tools as rounded badges",
        tags: ["tech", "stack", "skill", "badge", "language", "framework"],
        sample: "react-dark",
        monochrome: false,
        countryCodes: false,
        popular: words(`
            react-dark typescript javascript nodejs-dark docker kubernetes aws-dark gcp-dark
            azure-dark github-dark postgresql-dark mysql-dark mongodb redis-dark graphql-dark
            python-dark java-dark golang rust figma-dark
        `),
        pickNames: pickDarkVariant,
        displayName: name => name.replace(/-(dark|light)$/, ""),
    },
    {
        id: "vscode-icons",
        label: "Files",
        description: "File types and folders, as in VS Code",
        tags: ["file", "folder", "code", "vscode", "project"],
        sample: "default-folder",
        monochrome: false,
        countryCodes: false,
        popular: words(`
            default-folder default-file folder-type-src folder-type-test folder-type-docs
            folder-type-config folder-type-public folder-type-api file-type-typescript
            file-type-js file-type-reactts file-type-json file-type-docker file-type-yaml
            file-type-markdown file-type-python file-type-go file-type-rust file-type-sql
            file-type-git
        `),
        pickNames: names => names.filter(name => !name.endsWith("-opened")),
        displayName: fileDisplayName,
    },
    {
        id: "noto",
        label: "Emojis",
        description: "Faces, people, animals, food and things",
        tags: ["emoji", "smiley", "face"],
        sample: "grinning-face",
        monochrome: false,
        countryCodes: false,
        popular: words(`
            grinning-face face-with-tears-of-joy smiling-face-with-heart-eyes thinking-face
            thumbs-up clapping-hands fire rocket light-bulb warning check-mark-button cross-mark
            red-heart star party-popper hundred-points eyes sparkles bug hourglass-not-done
        `),
        // As emoji keyboards have them
        categoryOrder: [
            "Smileys & Emotion",
            "People & Body",
            "Animals & Nature",
            "Food & Drink",
            "Travel & Places",
            "Activities",
            "Objects",
            "Symbols",
            "Flags",
        ],
    },
    {
        id: "flagpack",
        label: "Flags",
        description: "Every country's flag",
        tags: ["flag", "country", "nation"],
        sample: "se",
        monochrome: false,
        countryCodes: true,
        popular: words("se no dk fi de fr gb-ukm us nl es it pl ch at be ie jp cn in br"),
    },
    {
        id: "circle-flags",
        label: "Round flags",
        description: "Flags as circles, with regions and the EU",
        tags: ["flag", "round", "circle", "country"],
        sample: "se",
        monochrome: false,
        countryCodes: true,
        popular: words("se no dk fi de fr gb us nl es it pl ch at be ie jp cn in european-union"),
    },
    {
        id: "carbon",
        label: "General",
        description: "Simple icons for people, data, devices and more",
        tags: ["general", "simple", "symbol"],
        sample: "cloud",
        monochrome: true,
        countryCodes: false,
        popular: words(`
            user user-multiple data-base cloud api application-web mobile laptop email document
            locked settings search chart-line flow network-3 server-dns folder calendar time
        `),
    },
    {
        id: "tabler",
        label: "Outline",
        description: "Over 6,000 outline icons, for anything General doesn't have",
        tags: ["outline", "line", "more"],
        sample: "bolt",
        monochrome: true,
        countryCodes: false,
        popular: words(`
            user users database server cloud api device-desktop device-mobile mail file lock
            settings search chart-line git-branch world bolt clock home shield
        `),
    },
    {
        id: "fluent-color",
        label: "Colorful",
        description: "Everyday icons in color: people, documents, places",
        tags: ["color", "colorful", "fluent"],
        sample: "lightbulb-48",
        monochrome: false,
        countryCodes: false,
        popular: words(`
            people-48 person-48 database-48 cloud-48 mail-48 document-48 calendar-48 chat-48
            settings-48 lock-closed-48 shield-48 home-48 laptop-48 phone-48 lightbulb-48
            warning-48 checkmark-circle-48 star-48 heart-48 clock-48
        `),
        pickNames: pickLargestSize,
        displayName: name => name.replace(/-\d+$/, ""),
    },
];

export const getIconSet = (id: IconSetId) => ICON_SETS.find(set => set.id === id) ?? ICON_SETS[0]!;

export const isIconSetId = (value: string): value is IconSetId =>
    (ICON_SET_IDS as readonly string[]).includes(value);

/** The names to show of a set's icons, one of each */
export const pickNames = (id: IconSetId, names: string[]) =>
    getIconSet(id).pickNames?.(names) ?? names;
