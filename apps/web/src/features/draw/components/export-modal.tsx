import { Modal } from "@/components/modal";
import { ExportOpts, useExport } from "@/features/draw/hooks/base/use-export";
import { ClipboardCopy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Label, Switch } from "ui";
import { NativeContainer } from "../models/native/native-container";
import toast from "react-hot-toast";

type ExportModalProps = {
    setShow: (show: boolean) => void;
    show: boolean;
};

export const ExportModal = ({ setShow, show }: ExportModalProps) => {
    const { exportToCanvas, exportToPng, exportToSvg, exportToClipboard, getPng } = useExport();

    const [png, setPng] = useState<string | undefined>();
    const [useDarkMode, setUseDarkMode] = useState(false);
    const [exportBackground, setExportBackground] = useState(false);

    useEffect(() => {
        const fetchCanvas = async () => {
            const opts: ExportOpts = {
                exportBackground,
                useDarkMode,
                format: "png", // does not matter for canvas
            };
            const element = await getPng(opts);

            if (element) {
                setPng(element);
            }
        };

        fetchCanvas();
    }, [exportToCanvas, png, useDarkMode, exportBackground]);

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
                    <div className="flex items-center justify-between border overflow-auto rounded-lg">
                        {png ? (
                            <img
                                src={png}
                                alt="Exported PNG"
                                style={{ width: "100%", height: "100%" }}
                            />
                        ) : (
                            <p>Loading...</p>
                        )}
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch id="dark-mode" onCheckedChange={setUseDarkMode} />
                        <Label htmlFor="dark-mode">Dark Mode</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="use-background" onCheckedChange={setExportBackground} />
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
                            toast.success("Copied to clipboard");
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
