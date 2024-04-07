import { CodeEditorLanguage } from "@/features/selected-element-visuals/models/code-editor-langauges";
import { create } from "zustand";

type UseCodeEditorStore = {
    selectedLanguage: CodeEditorLanguage;
    setSelectedLanguage: (selectedLanguage: CodeEditorLanguage) => void;
};

export const useCodeEditorStore = create<UseCodeEditorStore>(set => ({
    selectedLanguage: "JavaScript",
    setSelectedLanguage: (selectedLanguage: CodeEditorLanguage) => set({ selectedLanguage }),
}));
