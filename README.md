### GIT
- Avoid merging main into feature branches repeatedly — rebase instead.
- Delete merged branches to keep the repo tidy.
- Add well-written PR descriptions — even if you’re the only reviewer.
- Tag versions (v0.1.0, v1.0.0) when you hit milestones.
- Use GitHub Releases with changelogs — employers see structured progress.
- Use an industry-standard Branching Strategy:
```
main — Always deployable/stable.
dev — Integration branch for new features before merging to main.
feature branches — Named like feature/map-patcher or fix/memory-leak.
hotfix branches — For quick production fixes, e.g., hotfix/build-error.
```

#### Commit message types
- fix
- feat
- build
- chore
- docs
- style
- refactor
- perf
- test
e.g.:
```
feat: allow provided config object to extend other configs
```

---

### Use GitHub Issues + Project Boards
Use labels: bug, feature, enhancement, docs, refactor.

### Tags & Releases
- Tag versions (v0.1.0, v1.0.0) when you hit milestones.
- Use GitHub Releases with changelogs — employers see structured progress.