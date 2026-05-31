# Branch Protection Rules

Configure at: Settings → Branches → Add rule

## `main` branch
- Require pull request before merging: ✅
- Required approvals: 1
- Dismiss stale reviews: ✅
- Require status checks to pass:
  - `CI Gate` (from ci.yml)
  - `PR Title Check`
  - `CodeQL Analysis (javascript-typescript)`
  - `CodeQL Analysis (python)`
- Require branches to be up to date: ✅
- Require conversation resolution: ✅
- Restrict pushes: only allow via PR
- Allow force pushes: ❌
- Allow deletions: ❌

## `develop` branch
- Require pull request before merging: ✅
- Required approvals: 1
- Require status checks to pass:
  - `CI Gate`
  - `PR Title Check`
- Allow force pushes: ❌

## `staging` branch
- Require pull request before merging: ✅
- Required approvals: 1
- Require status checks to pass:
  - `CI Gate`
