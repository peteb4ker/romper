---
title: "Branch Protection Test"
owners: ["maintainer"]
last_reviewed: "2025-08-15"
tags: ["documentation"]
---

---
title: "Branch Protection Test"
owners: ["maintainer"]
last_reviewed: "2025-08-15"
tags: ["documentation"]
---

# Branch Protection Test

This is a small change to test the new branch protection rules.
The PR should now wait for all CI checks to complete before auto-merging.

Required checks:
- build
- lint  
- unit-tests
- e2e-tests-check
- SonarCloud Code Analysis

