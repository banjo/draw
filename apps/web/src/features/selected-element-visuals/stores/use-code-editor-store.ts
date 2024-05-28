import { CodeEditorLanguage } from "@/features/selected-element-visuals/models/code-editor-langauges";
import { create } from "zustand";

type UseCodeEditorStore = {
    selectedLanguage: CodeEditorLanguage;
    setSelectedLanguage: (selectedLanguage: CodeEditorLanguage) => void;
    fontSize: number;
    setFontSize: (fontSize: number) => void;
};

export const useCodeEditorStore = create<UseCodeEditorStore>(set => ({
    selectedLanguage: "JavaScript",
    setSelectedLanguage: (selectedLanguage: CodeEditorLanguage) => set({ selectedLanguage }),
    fontSize: 14,
    setFontSize: (fontSize: number) => set({ fontSize }),
}));
