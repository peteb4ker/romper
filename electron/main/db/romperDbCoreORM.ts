// Drizzle ORM implementation - Main entry point
// Core functions now delegate to extracted modules for better organization

// Import and re-export CRUD operations
export {
  addKit,
  addKitTx,
  addSample,
  addSampleTx,
  buildDeleteConditions,
  copyKit,
  deleteKit,
  deleteSamples,
  deleteSamplesTx,
  deleteSamplesWithoutReindexing,
  deleteSamplesWithoutReindexingTx,
  flagKitModified,
  getAllBanks,
  getAllSamples,
  getFavoriteKits,
  getFavoriteKitsCount,
  getKit,
  getKitDeleteSummary,
  getKits,
  getKitSamples,
  getKitsMetadata,
  getSamplesToDelete,
  markAllKitsAsSyncedExcept,
  markKitAsModified,
  markKitAsSynced,
  markKitsAsSynced,
  markKitsAsSyncedTx,
  mergeKitScan,
  mergeKitScanTx,
  toggleKitFavorite,
  updateBank,
  updateKit,
  updateSampleGain,
  updateSampleMetadata,
  updateVoiceAlias,
  updateVoiceSampleMode,
  updateVoiceSliceSettings,
  updateVoiceStereoMode,
  updateVoiceVolume,
} from "./operations/crudOperations.js";

// Import and re-export sample management operations
export { moveSample } from "./operations/sampleManagementOps.js";
export { moveSampleTx } from "./operations/sampleMovement.js";
// Import and re-export database utilities
export { DB_FILENAME } from "./utils/dbUtilities.js";

export {
  clearMigrationCache,
  closeAllDbConnections,
  closeDbConnection,
  createRomperDbFile,
  ensureDatabaseMigrations,
  type RomperDb,
  validateDatabaseSchema,
  withDb,
  withDbTransaction,
} from "./utils/dbUtilities.js";

// Re-export types for convenience
export type {
  DbResult,
  KitWithRelations,
  NewKit,
  NewSample,
  Sample,
} from "@romper/shared/db/schema.js";
