import { registerModalHandler } from "../../../utils/modalHandlerRegistry";
import { registerButtonHandler } from "../../../utils/buttonHandlerRegistry";
import { handleChampionModalPart1, handleChampionModalPart2 } from "./modals";
import { showChampionModalPart2 } from "./buttons";

export function registerChampionAdminHandlers() {
    registerModalHandler("addChampionModalPart1", handleChampionModalPart1);
    registerModalHandler("addChampionModalPart2", handleChampionModalPart2);
    registerButtonHandler("champion-add-part2", showChampionModalPart2);
}
