import { Modal } from "@/components/modal";
import { ExportOpts, useExport } from "@/features/draw/hooks/base/use-export";
import { ClipboardCopy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Label, Switch } from "ui";
import { NativeContainer } from "../models/native/native-container";

type ExportModalProps = {
    setShow: (show: boolean) => void;
    show: boolean;
};

export const ExportModal = ({ setShow, show }: ExportModalProps) => {
    const { exportToCanvas, exportToPng, exportToSvg, exportToClipboard } = useExport();

    const [canvas, setCanvas] = useState<HTMLCanvasElement | undefined>();
    const [useDarkMode, setUseDarkMode] = useState(false);
    const [exportBackground, setExportBackground] = useState(false);

    useEffect(() => {
        const fetchCanvas = async () => {
            const opts: ExportOpts = {
                exportBackground,
                useDarkMode,
                format: "png", // does not matter for canvas
            };
            const element = await exportToCanvas(opts);

            if (!canvas && element) {
                setCanvas(element);
            }
        };

        fetchCanvas();
    }, [exportToCanvas, canvas, useDarkMode, exportBackground]);

    const onClose = () => {
        NativeContainer.parse();
        NativeContainer.focus();
    };

    return (
        <Modal.Container show={show} setShow={setShow} onClose={onClose}>
            <Modal.Content className="w-96">
                <Modal.Header onClose={() => setShow(false)}>
                    <Modal.Title>Export</Modal.Title>
                    <Modal.Description>
                        Export your board as an image or SVG file.
                    </Modal.Description>
                </Modal.Header>
                <Modal.Body className="grid gap-4">
                    <div className="flex items-center justify-between border p-4 rounded-lg">
                        {canvas ? (
                            <canvas
                                ref={node => {
                                    if (node) {
                                        node.replaceWith(canvas);
                                        canvas.style.width = "100%";
                                        canvas.style.height = "100%";
                                    }
                                }}
                                style={{ width: "100%", height: "100%" }}
                            />
                        ) : (
                            <p>Loading...</p>
                        )}
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="dark-mode"
                            checked={useDarkMode}
                            onCheckedChange={checked => {
                                setUseDarkMode(checked);
                            }}
                        />
                        <Label htmlFor="dark-mode">Dark Mode</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="use-background"
                            checked={exportBackground}
                            onCheckedChange={checked => {
                                setExportBackground(checked);
                            }}
                        />
                        <Label htmlFor="use-background">Use Background</Label>
                    </div>

                    <div className="flex space-x-2">
                        <Button
                            onClick={async () => {
                                await exportToPng({
                                    exportBackground,
                                    useDarkMode,
                                    format: "png",
                                });
                            }}
                            variant="outline"
                            className="flex-1"
                        >
                            <Download className="h-5 w-5 mr-2" />
                            PNG
                        </Button>
                        <Button
                            onClick={async () => {
                                await exportToSvg({
                                    exportBackground,
                                    useDarkMode,
                                    format: "svg",
                                });
                            }}
                            variant="outline"
                            className="flex-1"
                        >
                            <Download className="h-5 w-5 mr-2" />
                            SVG
                        </Button>
                    </div>
                    <Button
                        onClick={async () => {
                            await exportToClipboard({
                                exportBackground,
                                useDarkMode,
                                format: "png",
                            });
                        }}
                        variant="outline"
                        className="w-full"
                    >
                        <ClipboardCopy className="h-5 w-5 mr-2" />
                        Copy to Clipboard
                    </Button>
                </Modal.Body>
            </Modal.Content>
        </Modal.Container>
    );
};
