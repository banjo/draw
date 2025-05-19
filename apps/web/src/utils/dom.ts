export const waitForElement = (querySelector: string, timeInMs = 100) =>
    new Promise<Element | null>(resolve => {
        const interval = setInterval(() => {
            const element = document.querySelector(querySelector);
            if (element) {
                clearInterval(interval);
                resolve(element);
            }
        }, timeInMs);
    });
