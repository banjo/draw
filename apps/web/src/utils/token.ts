import jwtDecode from "jwt-decode";

export type TokenWithExpiration = {
    exp: number;
};

const needRefresh = (token: string, safeTimeInMs: number) => {
    const decoded: TokenWithExpiration = jwtDecode(token);
    return decoded.exp * 1000 - safeTimeInMs < Date.now();
};

export const TokenUtil = {
    needRefresh,
};
