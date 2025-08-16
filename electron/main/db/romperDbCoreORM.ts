// Drizzle ORM implementation - Main entry point
// Core functions now delegate to extracted modules for better organization

import type {
  DbResult,
  KitWithRelations,
  NewKit,
  NewSample,
  Sample,
} from "@romper/shared/db/schema.js";

// Re-export types for convenience
export type { DbResult, KitWithRelations, NewKit, NewSample, Sample };

// Import and re-export CRUD operations
export {
  addKit,
  addSample,
  buildDeleteConditions,
  deleteSamples,
  deleteSamplesWithoutReindexing,
  getAllBanks,
  getAllSamples,
  getFavoriteKits,
  getFavoriteKitsCount,
  getKit,
  getKits,
  getKitSamples,
  getKitsMetadata,
  getSamplesToDelete,
  markKitAsModified,
  markKitAsSynced,
  markKitsAsSynced,
  setKitFavorite,
  toggleKitFavorite,
  updateBank,
  updateKit,
  updateVoiceAlias,
} from "./operations/crudOperations.js";
// Import and re-export sample management operations
export { moveSample } from "./operations/sampleManagementOps.js";

// Import and re-export database utilities
export { DB_FILENAME } from "./utils/dbUtilities.js";

export {
  createRomperDbFile,
  ensureDatabaseMigrations,
  validateDatabaseSchema,
  withDb,
} from "./utils/dbUtilities.js";
