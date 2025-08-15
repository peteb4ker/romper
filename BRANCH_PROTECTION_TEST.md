# Branch Protection Test

This is a small change to test the new branch protection rules.
The PR should now wait for all CI checks to complete before auto-merging.

Required checks:
- build
- lint  
- unit-tests
- e2e-tests-check
- SonarCloud Code Analysis

