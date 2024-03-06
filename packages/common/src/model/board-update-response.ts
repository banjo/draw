import { Board } from "./board";
import { BoardDeltaUpdate } from "./board-delta-update";

export type BoardUpdateResponse =
    | {
          type: "full";
          board: Board;
      }
    | {
          type: "delta";
          delta: BoardDeltaUpdate;
      };

const from = (data: Board | BoardDeltaUpdate): BoardUpdateResponse => {
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

const isDelta = (data: BoardUpdateResponse): data is { type: "delta"; delta: BoardDeltaUpdate } =>
    data.type === "delta";

export const BoardUpdateResponse = {
    from,
    isFullBoard,
    isDelta,
};
