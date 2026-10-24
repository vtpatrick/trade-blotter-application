// AG Grid needs its modules registered before any grid mounts, as main.ts does for the app.
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule])
