import { registerModalHandler } from "../../../utils/modalHandlerRegistry";
import { handleAttackAddModal } from "./handlers";

registerModalHandler("admin_attack_add_", handleAttackAddModal);
