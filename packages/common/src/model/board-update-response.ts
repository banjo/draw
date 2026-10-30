import { Board } from "./board";
import { BoardDeltaUpdate } from "./board-delta-update";
import { DrawingRole } from "./drawing-access";

export type BoardUpdateResponse =
    | {
          type: "full";
          board: Board;
      }
    | {
          type: "delta";
          delta: BoardDeltaUpdate;
      }
    | {
          /** The owner changed who can open the drawing, and this is your role now */
          type: "access";
          role: DrawingRole;
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

const access = (role: DrawingRole): BoardUpdateResponse => ({ type: "access", role });

const isFullBoard = (data: BoardUpdateResponse): data is { type: "full"; board: Board } =>
    data.type === "full";

const isDelta = (data: BoardUpdateResponse): data is { type: "delta"; delta: BoardDeltaUpdate } =>
    data.type === "delta";

const isAccess = (data: BoardUpdateResponse): data is { type: "access"; role: DrawingRole } =>
    data.type === "access";

export const BoardUpdateResponse = {
    from,
    access,
    isFullBoard,
    isDelta,
    isAccess,
};
