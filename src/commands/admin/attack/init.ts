import { registerModalHandler } from "../../../utils/modalHandlerRegistry";
import { handleAttackAddModal } from "./handlers";

export function registerAttackAdminHandlers() {
    registerModalHandler("admin_attack_add_", handleAttackAddModal);
}
