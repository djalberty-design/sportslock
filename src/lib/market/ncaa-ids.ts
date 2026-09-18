import { NCAA_ID_A } from "./ncaa-ids-a";
import { NCAA_ID_B } from "./ncaa-ids-b";

export const NCAA_ID: Record<string, { id: string; name: string }> = { ...NCAA_ID_A, ...NCAA_ID_B };
