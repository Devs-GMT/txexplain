import { CHAINS } from "../src/config.js";

export const CHAIN_NAMES = Object.fromEntries(Object.entries(CHAINS).map(([id, c]) => [id, c.name]));
