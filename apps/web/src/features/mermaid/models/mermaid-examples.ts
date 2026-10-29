/** A diagram to start from, one for each kind the dialog offers */
export type MermaidExample = { id: string; label: string; definition: string };

export const MERMAID_EXAMPLES: MermaidExample[] = [
    {
        id: "flowchart",
        label: "Flowchart",
        definition: `flowchart LR
    start([Open drawing]) --> auth{Signed in?}
    auth -- yes --> load[Load from API]
    auth -- no --> local[Load from browser]
    load --> show([Show canvas])
    local --> show`,
    },
    {
        id: "sequence",
        label: "Sequence",
        definition: `sequenceDiagram
    Browser->>API: GET /drawings/42
    API->>Database: select drawing
    Database-->>API: row
    API-->>Browser: 200 + elements`,
    },
    {
        id: "class",
        label: "Class",
        definition: `classDiagram
    class Drawing {
        +string slug
        +Element[] elements
        +save()
    }
    class User {
        +string name
    }
    User "1" --> "*" Drawing : owns`,
    },
    {
        id: "er",
        label: "ER",
        definition: `erDiagram
    USER ||--o{ DRAWING : owns
    DRAWING ||--o{ FILE : has
    USER {
        string id
        string name
    }
    DRAWING {
        string slug
        json elements
    }`,
    },
    {
        id: "state",
        label: "State",
        definition: `stateDiagram-v2
    [*] --> Draft
    Draft --> Shared : share
    Shared --> Draft : stop sharing
    Shared --> [*]`,
    },
    {
        id: "gantt",
        label: "Gantt",
        definition: `gantt
    dateFormat YYYY-MM-DD
    section Blocks
        Mermaid       :a1, 2026-11-02, 3d
        Swimlane      :a2, after a1, 3d
        Markdown note :a3, after a2, 2d`,
    },
    {
        id: "pie",
        label: "Pie",
        definition: `pie title Shapes used
    "Rectangle" : 48
    "Arrow" : 32
    "Text" : 20`,
    },
];
