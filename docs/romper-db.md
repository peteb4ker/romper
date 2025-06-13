---
layout: default
---

# Romper Database Schema

This document describes the schema for the Romper local SQLite database, which is created in the `.romperdb` folder inside the local store.

## Entity-Relationship Diagram (ERD)

<div class="mermaid">
%%{init: {"class": {"direction": "LR"}, "theme": "default", "themeVariables": {"fontSize": "14px"}}}%%

classDiagram

direction LR

class Plan {
  +int id
  +string name
  +datetime created_at
}

class Kit {
  +int id
  +int plan_id
  +string name
}

class Sample {
  +int id
  +int kit_id
  +string filename
  +string metadata
}

Plan "1" --> "0..*" Kit : contains
Kit "1" --> "0..*" Sample : contains
</div>

- **plans**: Top-level plan objects.
- **kits**: Each kit belongs to a plan.
- **samples**: Each sample belongs to a kit.

## Table Definitions

### plans
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `name` TEXT NOT NULL
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### kits
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `plan_id` INTEGER (FK to plans.id)
- `name` TEXT NOT NULL

### samples
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `kit_id` INTEGER (FK to kits.id)
- `filename` TEXT NOT NULL
- `metadata` TEXT (JSON-encoded)

---

_Last updated: 2025-06-12_
