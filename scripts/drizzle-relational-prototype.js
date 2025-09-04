#!/usr/bin/env node

/**
 * Drizzle Relational Query Prototype Testing
 * 
 * Incremental testing framework to understand how Drizzle relational queries
 * work in practice, using production database data to debug issues.
 * 
 * Usage: node scripts/drizzle-relational-prototype.js [production-db-path]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/db/schema.ts';
import deasync from 'deasync';

const { banks, kits, voices, samples } = schema;

// Console colors for better output readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const color = {
    'INFO': colors.blue,
    'SUCCESS': colors.green,
    'WARNING': colors.yellow,
    'ERROR': colors.red,
    'DEBUG': colors.magenta
  }[level] || colors.reset;

  console.log(`${color}[${level}] ${timestamp} - ${message}${colors.reset}`);
  if (data !== null) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function findProductionDatabase() {
  // Common locations for Romper production database
  const possiblePaths = [
    // User provided path via command line
    process.argv[2],
    // Common macOS app data locations
    path.join(os.homedir(), 'Library', 'Application Support', 'Romper', '.romperdb', 'romper.sqlite'),
    path.join(os.homedir(), 'Documents', 'Romper', '.romperdb', 'romper.sqlite'),
    // Current project locations (for development)
    path.join(process.cwd(), '.romperdb', 'romper.sqlite'),
    path.join(process.cwd(), '..', '.romperdb', 'romper.sqlite'),
    // Test database location
    path.join(process.cwd(), 'electron', 'main', 'db', '__tests__', 'test-data', 'romper.sqlite'),
  ].filter(Boolean);

  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      log('SUCCESS', `Found database at: ${dbPath}`);
      return dbPath;
    } else {
      log('DEBUG', `Database not found at: ${dbPath}`);
    }
  }

  throw new Error('No production database found. Please specify path as argument.');
}

function validateDatabaseSchema(sqlite) {
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all();
    
  const tableNames = tables.map(t => t.name).sort();
  log('INFO', `Found ${tables.length} tables`, tableNames);

  const expectedTables = ['banks', 'kits', 'samples', 'voices'];
  const missingTables = expectedTables.filter(table => !tableNames.includes(table));
  
  if (missingTables.length > 0) {
    throw new Error(`Missing expected tables: ${missingTables.join(', ')}`);
  }

  // Get row counts for each table
  const counts = {};
  for (const table of expectedTables) {
    const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    counts[table] = result.count;
  }
  
  log('SUCCESS', 'Database schema validated', counts);
  return counts;
}

async function testBasicQueries(db, sqlite) {
  log('INFO', '=== Testing Basic Non-Relational Queries ===');

  try {
    // Test basic kit query
    const allKits = db.select().from(kits).all();
    log('SUCCESS', `Found ${allKits.length} kits`);

    if (allKits.length > 0) {
      const firstKit = allKits[0];
      log('DEBUG', 'First kit data', firstKit);

      // Test basic voice query for this kit
      const kitVoices = db.select().from(voices)
        .where(eq(voices.kit_name, firstKit.name))
        .all();
      log('SUCCESS', `Found ${kitVoices.length} voices for kit: ${firstKit.name}`);

      // Test basic sample query for this kit
      const kitSamples = db.select().from(samples)
        .where(eq(samples.kit_name, firstKit.name))
        .all();
      log('SUCCESS', `Found ${kitSamples.length} samples for kit: ${firstKit.name}`);

      return firstKit.name; // Return kit name for further testing
    }
    
    return null;
  } catch (error) {
    log('ERROR', 'Basic query test failed', { error: error.message });
    throw error;
  }
}

async function testRelationalQueries(db, testKitName) {
  log('INFO', '=== Testing Drizzle Relational Queries ===');

  if (!testKitName) {
    log('WARNING', 'No test kit available, skipping relational query tests');
    return;
  }

  try {
    // Level 1: Single relation (kit -> bank)
    log('INFO', '--- Level 1: Kit with Bank Relation ---');
    const kitWithBankQuery = db.query.kits.findFirst({
      where: (kits, { eq }) => eq(kits.name, testKitName),
      with: { bank: true }
    });
    
    log('DEBUG', 'Query object (before execution)', { 
      isPromise: kitWithBankQuery instanceof Promise,
      constructor: kitWithBankQuery.constructor.name
    });

    let kitWithBank;
    if (kitWithBankQuery instanceof Promise) {
      log('INFO', 'Query is a Promise, using deasync to make synchronous');
      kitWithBank = deasync(kitWithBankQuery);
    } else {
      log('INFO', 'Query is synchronous, executing directly');
      kitWithBank = kitWithBankQuery;
    }

    log('DEBUG', 'Level 1 result', kitWithBank);
    
    // Level 2: One-to-many (kit -> voices)
    log('INFO', '--- Level 2: Kit with Voices Relation ---');
    const kitWithVoicesQuery = db.query.kits.findFirst({
      where: (kits, { eq }) => eq(kits.name, testKitName),
      with: { 
        voices: {
          orderBy: (voices, { asc }) => [asc(voices.voice_number)]
        }
      }
    });

    let kitWithVoices;
    if (kitWithVoicesQuery instanceof Promise) {
      kitWithVoices = deasync(kitWithVoicesQuery);
    } else {
      kitWithVoices = kitWithVoicesQuery;
    }

    log('DEBUG', 'Level 2 result', kitWithVoices);

    // Level 3: Complex multi-level (kit -> all relations)
    log('INFO', '--- Level 3: Kit with All Relations ---');
    const kitWithAllQuery = db.query.kits.findFirst({
      where: (kits, { eq }) => eq(kits.name, testKitName),
      with: {
        bank: true,
        voices: {
          orderBy: (voices, { asc }) => [asc(voices.voice_number)]
        },
        samples: {
          orderBy: (samples, { asc }) => [asc(samples.voice_number), asc(samples.slot_number)]
        }
      }
    });

    let kitWithAll;
    if (kitWithAllQuery instanceof Promise) {
      kitWithAll = deasync(kitWithAllQuery);
    } else {
      kitWithAll = kitWithAllQuery;
    }

    log('DEBUG', 'Level 3 result', kitWithAll);

    // Test findMany as well
    log('INFO', '--- Testing findMany with Relations ---');
    const allKitsWithRelationsQuery = db.query.kits.findMany({
      with: {
        bank: true,
        voices: true,
        samples: true
      },
      limit: 3 // Limit for testing
    });

    let allKitsWithRelations;
    if (allKitsWithRelationsQuery instanceof Promise) {
      allKitsWithRelations = deasync(allKitsWithRelationsQuery);
    } else {
      allKitsWithRelations = allKitsWithRelationsQuery;
    }

    log('DEBUG', 'findMany result', { 
      count: allKitsWithRelations?.length || 0,
      sample: allKitsWithRelations?.[0] 
    });

  } catch (error) {
    log('ERROR', 'Relational query test failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

async function testExecutionMethods(db, testKitName) {
  log('INFO', '=== Testing Different Execution Methods ===');

  if (!testKitName) {
    log('WARNING', 'No test kit available, skipping execution method tests');
    return;
  }

  try {
    const baseQuery = db.query.kits.findFirst({
      where: (kits, { eq }) => eq(kits.name, testKitName),
      with: { bank: true, voices: true }
    });

    log('INFO', '--- Testing .execute() method ---');
    try {
      let executeResult;
      if (typeof baseQuery.execute === 'function') {
        const executed = baseQuery.execute();
        executeResult = executed instanceof Promise ? deasync(executed) : executed;
        log('SUCCESS', '.execute() method works', executeResult);
      } else {
        log('WARNING', '.execute() method not available');
      }
    } catch (error) {
      log('ERROR', '.execute() failed', { error: error.message });
    }

    log('INFO', '--- Testing .all() method ---');
    try {
      let allResult;
      if (typeof baseQuery.all === 'function') {
        const all = baseQuery.all();
        allResult = all instanceof Promise ? deasync(all) : all;
        log('SUCCESS', '.all() method works', allResult);
      } else {
        log('WARNING', '.all() method not available');
      }
    } catch (error) {
      log('ERROR', '.all() failed', { error: error.message });
    }

    log('INFO', '--- Testing .get() method ---');
    try {
      let getResult;
      if (typeof baseQuery.get === 'function') {
        const get = baseQuery.get();
        getResult = get instanceof Promise ? deasync(get) : get;
        log('SUCCESS', '.get() method works', getResult);
      } else {
        log('WARNING', '.get() method not available');
      }
    } catch (error) {
      log('ERROR', '.get() failed', { error: error.message });
    }

  } catch (error) {
    log('ERROR', 'Execution method test failed', { error: error.message });
    throw error;
  }
}

async function compareWithManualQueries(db, testKitName) {
  log('INFO', '=== Comparing with Manual JOIN Queries ===');

  if (!testKitName) {
    log('WARNING', 'No test kit available, skipping manual query comparison');
    return;
  }

  try {
    // Manual query using joins (current working approach)
    log('INFO', '--- Manual JOIN Query ---');
    const manualResult = db
      .select()
      .from(kits)
      .leftJoin(banks, eq(kits.bank_letter, banks.letter))
      .where(eq(kits.name, testKitName))
      .get();

    log('DEBUG', 'Manual JOIN result', manualResult);

    // Get related data separately (current batch approach)
    const manualVoices = db
      .select()
      .from(voices)
      .where(eq(voices.kit_name, testKitName))
      .orderBy(voices.voice_number)
      .all();

    const manualSamples = db
      .select()
      .from(samples)
      .where(eq(samples.kit_name, testKitName))
      .orderBy(samples.voice_number, samples.slot_number)
      .all();

    log('SUCCESS', 'Manual queries completed', {
      kit: !!manualResult,
      voices: manualVoices.length,
      samples: manualSamples.length
    });

    // Now compare with relational query
    log('INFO', '--- Relational Query for Comparison ---');
    const relationalQuery = db.query.kits.findFirst({
      where: (kits, { eq }) => eq(kits.name, testKitName),
      with: {
        bank: true,
        voices: {
          orderBy: (voices, { asc }) => [asc(voices.voice_number)]
        },
        samples: {
          orderBy: (samples, { asc }) => [asc(samples.voice_number), asc(samples.slot_number)]
        }
      }
    });

    let relationalResult;
    if (relationalQuery instanceof Promise) {
      relationalResult = deasync(relationalQuery);
    } else {
      relationalResult = relationalQuery;
    }

    log('DEBUG', 'Relational query result', relationalResult);

    // Compare results
    log('INFO', '--- Result Comparison ---');
    const comparison = {
      manual: {
        hasKit: !!manualResult,
        voiceCount: manualVoices.length,
        sampleCount: manualSamples.length
      },
      relational: {
        hasKit: !!relationalResult,
        voiceCount: relationalResult?.voices?.length || 0,
        sampleCount: relationalResult?.samples?.length || 0
      }
    };

    log('INFO', 'Comparison results', comparison);

  } catch (error) {
    log('ERROR', 'Manual query comparison failed', { error: error.message });
    throw error;
  }
}

async function main() {
  try {
    log('INFO', '=== Drizzle Relational Query Prototype Testing ===');
    log('INFO', `Drizzle ORM Version: ${JSON.stringify(schema, null, 2).slice(0, 100)}...`);
    
    // Phase 1: Find and connect to database
    const dbPath = findProductionDatabase();
    
    // Create backup
    const backupPath = dbPath + '.backup.' + Date.now();
    fs.copyFileSync(dbPath, backupPath);
    log('SUCCESS', `Database backed up to: ${backupPath}`);

    // Connect to database (read-only)
    const sqlite = new BetterSqlite3(dbPath, { readonly: true });
    const db = drizzle(sqlite, { schema });

    // Phase 2: Basic validation and connectivity
    const counts = validateDatabaseSchema(sqlite);
    const testKitName = await testBasicQueries(db, sqlite);

    // Phase 3: Incremental relational query testing
    await testRelationalQueries(db, testKitName);
    
    // Phase 4: Execution method testing
    await testExecutionMethods(db, testKitName);

    // Phase 5: Comparison with working manual queries
    await compareWithManualQueries(db, testKitName);

    sqlite.close();
    log('SUCCESS', 'Prototype testing completed successfully');
    
  } catch (error) {
    log('ERROR', 'Prototype testing failed', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main, testBasicQueries, testRelationalQueries };