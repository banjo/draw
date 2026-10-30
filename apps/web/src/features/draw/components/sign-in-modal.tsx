import "@fontsource-variable/bricolage-grotesque";
import { Modal } from "@/components/modal";
import { drawIllustration } from "@/features/features-intro/models/illustrations";
import { authService } from "@/services/auth-service";
import { isLocalDevelopment } from "@/utils/runtime";
import { AI_FREE_DAILY_LIMIT } from "common";
import { FolderIcon, Laptop, LucideIcon, MonitorSmartphone, Sparkles, X } from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";
import { cn } from "ui";
import { NativeContainer } from "../models/native/native-container";

type SignInModalProps = {
    setShow: (show: boolean) => void;
    show: boolean;
};

const PERKS: { Icon: LucideIcon; title: string; text: string }[] = [
    {
        Icon: FolderIcon,
        title: "Your own collection",
        text: "Save drawings, sort them in folders.",
    },
    { Icon: MonitorSmartphone, title: "On any device", text: "Pick up where you left off." },
    {
        Icon: Sparkles,
        title: "Create with AI",
        text: `${AI_FREE_DAILY_LIMIT} diagrams a day for free.`,
    },
];

const GoogleLogo = () => (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0" aria-hidden>
        <path
            fill="#FFC107"
            d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
        />
        <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
            fill="#4CAF50"
            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
        />
        <path
            fill="#1976D2"
            d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
        />
    </svg>
);

const GithubLogo = () => (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-[18px] w-[18px] shrink-0" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
);

const ProviderButton = ({
    onClick,
    isDark,
    children,
}: {
    onClick: () => void;
    isDark?: boolean;
    children: ReactNode;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "flex h-11 w-full items-center justify-center gap-2.5 rounded-xl text-[14.5px] font-semibold transition active:scale-[0.98]",
            isDark
                ? "bg-[#1b1b1f] text-white hover:bg-black dark:bg-white dark:text-[#1b1b1f] dark:hover:bg-zinc-200"
                : "bg-white text-[#1b1b1f] shadow-[inset_0_0_0_1px_rgba(20,20,40,0.14)] hover:bg-zinc-50 dark:bg-[#2a2a31] dark:text-zinc-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:hover:bg-[#32323a]"
        )}
    >
        {children}
    </button>
);

/** Drawings, an AI sparkle and two people drawing along, hand-drawn like the canvas */
const Picture = () => {
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (ref.current) drawIllustration("sign-in", ref.current, 3);
    }, []);

    return (
        <div className="relative hidden bg-[#fbf3e7] bg-[radial-gradient(rgba(150,100,40,0.13)_1.2px,transparent_1.2px)] bg-[length:20px_20px] sm:block dark:bg-[#2a221a] dark:bg-[radial-gradient(rgba(240,166,80,0.12)_1.2px,transparent_1.2px)]">
            <svg
                ref={ref}
                aria-hidden
                preserveAspectRatio="xMidYMid meet"
                // Excalidraw's dark mode filter, like the canvas
                className="absolute inset-x-6 bottom-14 top-8 h-[calc(100%-88px)] w-[calc(100%-48px)] dark:[filter:invert(93%)_hue-rotate(180deg)]"
            />
            <span className="absolute bottom-5 left-6 font-['Excalifont',cursive] text-[17px] text-[#9a5512] dark:text-[#f0a650]">
                all your drawings, in one place
            </span>
        </div>
    );
};

export const SignInModal = ({ setShow, show }: SignInModalProps) => {
    const onClose = () => {
        NativeContainer.parse();
        NativeContainer.focus();
    };

    return (
        <Modal.Container
            show={show}
            setShow={setShow}
            onClose={onClose}
            backgroundClassName="backdrop-blur-[3px] p-4"
        >
            <div
                role="dialog"
                aria-modal
                aria-labelledby="sign-in-title"
                className="relative grid w-full max-w-[400px] overflow-hidden rounded-[20px] bg-white text-[#1b1b1f] shadow-[0_30px_80px_-24px_rgba(20,20,50,0.5),0_0_0_1px_rgba(20,20,40,0.06)] sm:max-w-[780px] sm:grid-cols-2 dark:bg-[#232329] dark:text-zinc-100 dark:shadow-[0_30px_80px_-24px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)]"
            >
                <button
                    type="button"
                    aria-label="Close"
                    onClick={() => {
                        onClose();
                        setShow(false);
                    }}
                    className="absolute right-3.5 top-3.5 z-10 grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                >
                    <X className="h-[18px] w-[18px]" />
                </button>
                <Picture />
                <div className="flex flex-col px-7 pb-7 pt-9 sm:px-9 sm:pt-11">
                    <img src="/banjodraw.svg" alt="" className="h-11 w-11 rounded-xl" />
                    <h2
                        id="sign-in-title"
                        className="mt-4 font-['Bricolage_Grotesque_Variable',sans-serif] text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]"
                    >
                        Welcome to BanjoDraw
                    </h2>
                    <ul className="mb-6 mt-5 grid gap-3">
                        {PERKS.map(({ Icon, title, text }) => (
                            <li key={title} className="flex items-center gap-3 text-[13.5px]">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#de9239]/15 text-[#b8681c] dark:text-[#f0a650]">
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="leading-snug">
                                    <span className="block font-semibold">{title}</span>
                                    <span className="text-zinc-500 dark:text-zinc-400">{text}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-auto grid gap-2.5">
                        <ProviderButton onClick={() => authService.signInWithGoogle()}>
                            <GoogleLogo />
                            Continue with Google
                        </ProviderButton>
                        <ProviderButton isDark onClick={() => authService.signInWithGithub()}>
                            <GithubLogo />
                            Continue with GitHub
                        </ProviderButton>
                        {isLocalDevelopment() ? (
                            <ProviderButton onClick={() => authService.signInLocally()}>
                                <Laptop className="h-[18px] w-[18px]" />
                                Sign in locally
                            </ProviderButton>
                        ) : null}
                        <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
                            Free. No password needed.
                        </p>
                    </div>
                </div>
            </div>
        </Modal.Container>
    );
};
