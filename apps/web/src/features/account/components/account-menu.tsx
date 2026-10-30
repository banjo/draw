import { PlanBadge } from "@/components/plan-badge";
import { SketchFrame } from "@/components/sketch-frame";
import { SketchIllustration } from "@/features/features-intro/components/sketch-illustration";
import { BRAND_TEXT, PEACH_BACKGROUND, SKETCH, SKETCH_TEXT } from "@/models/brand";
import "@fontsource-variable/bricolage-grotesque";
import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { useAiDialogStore } from "@/features/ai/stores/use-ai-dialog-store";
import { usePaletteStore } from "@/features/collection/stores/use-palette-store";
import { useFeaturesModalStore } from "@/features/features-intro/stores/use-features-modal-store";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/providers/theme-provider";
import { authService } from "@/services/auth-service";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";
import { formatShortcut } from "@/utils/platform";
import { AiStatus } from "common";
import {
    BrushIcon,
    Keyboard,
    LogIn,
    LogOut,
    LucideIcon,
    Monitor,
    Moon,
    SearchIcon,
    Sparkles,
    Sun,
} from "lucide-react";
import { ReactNode, useState } from "react";
import {
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "ui";

type Props = {
    toggleSidebar: () => void;
};

// Excalidraw closes an undocked sidebar on clicks outside it, which includes this menu
const PREVENT_OUTSIDE_CLICK = { "data-prevent-outside-click": true };

const ITEM =
    "h-9 gap-2.5 rounded-lg px-2.5 cursor-pointer text-[13px] [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:opacity-70";

const getInitials = (name: string | undefined, email: string) => {
    const words = (name || email.split("@")[0] || "?").split(/[\s._-]+/).filter(Boolean);
    return words
        .slice(0, 2)
        .map(word => word[0]?.toUpperCase())
        .join("");
};

const Avatar = ({ className }: { className?: string }) => {
    const { avatarUrl, name, email } = useAuth();
    const [hasError, setHasError] = useState(false);

    return (
        <span
            className={cn(
                "relative isolate grid shrink-0 place-items-center rounded-full font-semibold",
                SKETCH_TEXT,
                className
            )}
        >
            <SketchFrame shape="ellipse" fill={SKETCH.pastel} strokeWidth={1.3} seed={3} />
            {avatarUrl && !hasError ? (
                <img
                    src={avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-[calc(100%-6px)] w-[calc(100%-6px)] rounded-full object-cover"
                    onError={() => setHasError(true)}
                />
            ) : (
                getInitials(name, email)
            )}
        </span>
    );
};

const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Today's AI requests: what's left for free accounts, unlimited for Pro */
const AiUsage = ({ status }: { status: AiStatus }) => {
    const isPro = status.limit === null;
    const left = isPro ? 0 : Math.max(status.limit! - status.used, 0);
    const share = isPro ? 1 : left / status.limit!;
    const getFooter = () => {
        if (isPro) return `${status.used} made today`;
        const time = formatTime(status.resetsAt);
        return left === 0 ? `Back at ${time}` : `Resets at ${time}`;
    };

    return (
        <DropdownMenuItem
            onSelect={() => useAiDialogStore.getState().open()}
            className="mx-1 mb-1.5 block cursor-pointer rounded-[10px] bg-black/[0.04] px-3 py-2.5 focus:bg-black/[0.07] dark:bg-white/[0.05] dark:focus:bg-white/[0.09]"
        >
            <span className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                <Sparkles className={cn("h-4 w-4", BRAND_TEXT)} />
                Create with AI
                <span className="ml-auto text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {isPro ? "Unlimited" : `${left} of ${status.limit} left`}
                </span>
            </span>
            <span
                role="meter"
                aria-label="AI requests left today"
                aria-valuemin={0}
                aria-valuemax={isPro ? 1 : status.limit!}
                aria-valuenow={isPro ? 1 : left}
                className="relative isolate block h-3 p-[3px]"
            >
                <SketchFrame fill="#ffffff" radius={3} strokeWidth={1.2} seed={9} />
                <span
                    className="block h-full rounded-[2px] bg-[#ffc078] transition-all dark:bg-[#8a5a24]"
                    style={{ width: `${share * 100}%` }}
                />
            </span>
            <span className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">
                {getFooter()}
            </span>
        </DropdownMenuItem>
    );
};

const THEMES: { value: "light" | "dark" | "system"; label: string; Icon: LucideIcon }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
];

const ThemeRow = () => {
    const { theme, setTheme } = useTheme();
    const ThemeIcon = THEMES.find(item => item.value === theme)?.Icon ?? Monitor;

    return (
        <div className="flex h-9 items-center gap-2.5 px-2.5 text-[13px]">
            <ThemeIcon className="h-4 w-4 opacity-70" />
            Theme
            <div
                role="radiogroup"
                aria-label="Theme"
                className="ml-auto flex gap-0.5 rounded-[9px] p-0.5 ring-1 ring-inset ring-black/10 dark:ring-white/10"
            >
                {THEMES.map(({ value, label, Icon }) => (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={theme === value}
                        aria-label={label}
                        title={label}
                        onClick={() => setTheme(value)}
                        className={cn(
                            "grid h-[26px] w-[30px] place-items-center rounded-[7px] text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                            theme === value &&
                                "bg-[#de9239]/15 text-[#9a5512] hover:text-[#9a5512] dark:text-[#f0a650] dark:hover:text-[#f0a650]"
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" />
                    </button>
                ))}
            </div>
        </div>
    );
};

const Shortcut = ({ children }: { children: ReactNode }) => (
    <span className="ml-auto text-[11.5px] tracking-wide text-zinc-400">{children}</span>
);

/** Features, help and the theme: for everyone */
const AppItems = () => {
    const { excalidrawApi } = useGlobal();
    const showFeatures = useFeaturesModalStore(s => s.show);

    return (
        <>
            <ThemeRow />
            <DropdownMenuItem className={ITEM} onSelect={() => showFeatures("all")}>
                <Sparkles />
                Features
            </DropdownMenuItem>
            <DropdownMenuItem
                className={ITEM}
                onSelect={() =>
                    excalidrawApi?.updateScene({
                        appState: { ...excalidrawApi.getAppState(), openDialog: { name: "help" } },
                    })
                }
            >
                <Keyboard />
                Shortcuts and help
                <Shortcut>?</Shortcut>
            </DropdownMenuItem>
        </>
    );
};

const Cover = () => (
    <div className={cn("relative -mx-1.5 -mt-1.5 h-[74px] overflow-hidden", PEACH_BACKGROUND)}>
        <SketchIllustration
            id="doodles"
            seed={2}
            className="absolute -top-2 right-2 !h-[90px] !w-[140px]"
        />
    </div>
);

const SignedIn = ({ toggleSidebar }: Props) => {
    const { name, email } = useAuth();
    const { data: status } = trpc.ai.status.useQuery();
    const openPalette = usePaletteStore(s => s.setIsOpen);

    return (
        <>
            <Cover />
            <div className="relative -mt-8 px-3 pb-3">
                <Avatar className="h-16 w-16 bg-white text-[22px] ring-4 ring-white dark:bg-[#232329] dark:ring-[#232329]" />
                <div className="mt-2 flex items-center gap-2">
                    <span className="truncate font-['Bricolage_Grotesque_Variable',sans-serif] text-[19px] font-extrabold tracking-[-0.01em]">
                        {name || email.split("@")[0]}
                    </span>
                    {status ? <PlanBadge plan={status.plan} /> : null}
                </div>
                {name ? (
                    <div className="truncate text-[12.5px] text-zinc-500 dark:text-zinc-400">
                        {email}
                    </div>
                ) : null}
            </div>
            {status?.isEnabled ? <AiUsage status={status} /> : null}
            <DropdownMenuSeparator className="mx-1" />
            <DropdownMenuItem className={ITEM} onSelect={toggleSidebar}>
                <BrushIcon />
                My collection
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} onSelect={() => openPalette(true)}>
                <SearchIcon />
                Find a drawing
                <Shortcut>{formatShortcut("O")}</Shortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="mx-1" />
            <AppItems />
            <DropdownMenuSeparator className="mx-1" />
            <DropdownMenuItem
                className={cn(ITEM, "text-[#c92a2a] focus:text-[#c92a2a] dark:text-[#ff8787]")}
                onSelect={async () => await authService.signOut()}
            >
                <LogOut />
                Sign out
            </DropdownMenuItem>
        </>
    );
};

/**
 * Your avatar at the top right, with your account, plan and AI requests left. Signed out,
 * a "Sign in" button that opens the sign-in window; the theme, features and help are in the
 * main menu then.
 */
export const AccountMenu = ({ toggleSidebar }: Props) => {
    const { isAuthenticated } = useAuth();
    const utils = trpc.useUtils();
    const setShowSignInModal = useSignInModalStore(s => s.setShowSignInModal);

    if (!isAuthenticated) {
        return (
            <button
                type="button"
                className="sidebar-trigger order-last"
                onClick={() => setShowSignInModal(true)}
            >
                <LogIn className="h-4 w-4" />
                <span>Sign in</span>
            </button>
        );
    }

    return (
        <DropdownMenu
            modal={false}
            onOpenChange={isOpen => {
                if (isOpen) void utils.ai.status.invalidate();
            }}
        >
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Account"
                    // After Excalidraw's Library button
                    className="order-last grid h-9 w-9 place-items-center rounded-full outline-none ring-[#ffa94d] ring-offset-2 ring-offset-[var(--color-surface-lowest,#fff)] transition hover:ring-2 focus-visible:ring-2 data-[state=open]:ring-2"
                >
                    <Avatar className="h-8 w-8 text-[12px]" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                {...PREVENT_OUTSIDE_CLICK}
                align="end"
                sideOffset={8}
                className="w-[300px] rounded-[14px] border-0 bg-white p-1.5 text-zinc-900 shadow-[0_20px_50px_-18px_rgba(25,25,60,.35),0_0_0_1px_rgba(20,20,40,.07)] dark:bg-[#232329] dark:text-zinc-100 dark:shadow-[0_24px_60px_-20px_rgba(0,0,0,.9),0_0_0_1px_rgba(255,255,255,.08)]"
            >
                <SignedIn toggleSidebar={toggleSidebar} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
