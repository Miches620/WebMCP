// test_role_dependencies.mjs — corre los 8 tests del validador role_dependencies.
// (El "if import.meta.url === file://argv[1]" del módulo no dispara en Windows:
// E:\... nunca es igual a file:///E:/..., y `node validation_profile_role_dependencies.mjs`
// salía sin correr nada.)
import { runRoleDependencyProfileTests } from "./validation_profile_role_dependencies.mjs";
await runRoleDependencyProfileTests();
