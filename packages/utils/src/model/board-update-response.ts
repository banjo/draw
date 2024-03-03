import { Board } from "./board";
import { DeltaBoardUpdate } from "./delta-board-update";

export type BoardUpdateResponse =
    | {
          type: "full";
          board: Board;
      }
    | {
          type: "delta";
          delta: DeltaBoardUpdate;
      };

const from = (data: Board | DeltaBoardUpdate): BoardUpdateResponse => {
    if ("elements" in data) {
        return {
            type: "full",
            board: data,
        };
    }

    return {
        type: "delta",
        delta: data,
    };
};

const isFullBoard = (data: BoardUpdateResponse): data is { type: "full"; board: Board } =>
    data.type === "full";

const isDelta = (data: BoardUpdateResponse): data is { type: "delta"; delta: DeltaBoardUpdate } =>
    data.type === "delta";

export const BoardUpdateResponse = {
    from,
    isFullBoard,
    isDelta,
};
