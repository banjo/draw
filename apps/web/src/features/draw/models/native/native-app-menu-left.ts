class NativeAppMenuLeftClass {
    private element: HTMLDivElement | null = null;
    private querySelector = ".App-menu__left";

    constructor() {}

    public parse() {
        this.element = document.querySelector<HTMLDivElement>(this.querySelector);
    }

    public hide() {
        this.element?.setAttribute("style", "display: none");
    }

    public show() {
        this.element?.setAttribute("style", "display: block");
    }
}

export const NativeAppMenuLeft = new NativeAppMenuLeftClass();
