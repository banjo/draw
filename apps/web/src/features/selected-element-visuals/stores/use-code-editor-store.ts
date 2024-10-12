import { CodeEditorLanguage } from "@/features/selected-element-visuals/models/code-editor-langauges";
import { create } from "zustand";

type SelectedLanguageMap = Map<string, CodeEditorLanguage>;

type UseCodeEditorStore = {
    selectedLanguages: SelectedLanguageMap;
    setSelectedLanguage: (elementId: string, selectedLanguage: CodeEditorLanguage) => void;
    getSelectedLanguage: (elementId: string) => CodeEditorLanguage;
    fontSize: number;
    setFontSize: (fontSize: number) => void;
    isEditing: boolean;
    setIsEditing: (isEditing: boolean) => void;
};

export const useCodeEditorStore = create<UseCodeEditorStore>((set, get) => ({
    selectedLanguages: new Map(),
    setSelectedLanguage: (elementId: string, selectedLanguage: CodeEditorLanguage) =>
        set(state => {
            const current = state.selectedLanguages.get(elementId);
            if (current === selectedLanguage) return state;
            state.selectedLanguages.set(elementId, selectedLanguage);
            return state;
        }),
    getSelectedLanguage: (elementId: string) =>
        get().selectedLanguages.get(elementId) ?? "JavaScript",
    fontSize: 14,
    setFontSize: (fontSize: number) => set({ fontSize }),
    isEditing: false,
    setIsEditing: (isEditing: boolean) => set({ isEditing }),
}));
