import { Modal } from "@/components/modal";
import { authService } from "@/services/auth-service";
import { Chrome, Github } from "lucide-react";
import { Button } from "ui";
import { NativeContainer } from "../models/native/native-container";

type SignInModalProps = {
    setShow: (show: boolean) => void;
    show: boolean;
};

export const SignInModal = ({ setShow, show }: SignInModalProps) => {
    const onClose = () => {
        NativeContainer.parse();
        NativeContainer.focus();
    };

    return (
        <Modal.Container show={show} setShow={setShow} onClose={onClose}>
            <Modal.Content className="w-96">
                <Modal.Header onClose={() => setShow(false)}>
                    <Modal.Title>Sign in</Modal.Title>
                    <Modal.Description>
                        Sign in to save your drawings and access them from any device.
                    </Modal.Description>
                </Modal.Header>
                <Modal.Body className="grid gap-4">
                    <Button variant="outline" className="w-full">
                        <Chrome className="h-5 w-5 mr-2" />
                        Sign in with Google
                    </Button>
                    <Button
                        onClick={() => authService.signInWithGithub()}
                        variant="outline"
                        className="w-full"
                    >
                        <Github className="h-5 w-5 mr-2" />
                        Sign in with GitHub
                    </Button>
                </Modal.Body>
            </Modal.Content>
        </Modal.Container>
    );
};
