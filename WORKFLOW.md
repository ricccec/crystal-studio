## 🛠 Git Workflow

This project follows a **Git Flow** style branching model, even for solo development, to keep history clean and traceable.

---

### **Branch Structure**
- **`main`** → Production-ready code (latest stable release).
- **`dev`** → Integration branch for tested features (next release).
- **`feature/...`** → One branch per feature, bugfix, or chore.

Example:
```bash
- main
- dev
- feature/restructure-project-layout
- feature/map-editor-toolbar
- feature/fix-drag-bug
```

### **Step-by-Step Workflow**

#### 1. Start a new feature
```bash
git checkout dev
git pull origin dev
git checkout -b feature/my-new-feature
```

#### 2. Work and commit
Commit often, with meaningful messages:
```bash
feat: add toolbar buttons for map editor
fix: correct coordinate conversion bug
chore: reorganize assets folder
```
- feat → New feature
- fix → Bug fix
- chore → Maintenance, refactor, or non-functional change

#### 3. Push your branch
```bash
git push -u origin feature/my-new-feature
```
Backs up your branch and prepares it for a pull request.

#### 4. Create a Pull Request (PR)
On GitHub:
- Base branch → dev
- Compare branch → feature/my-new-feature
- PR Title → Short, imperative description (feat: add map metadata editor)
- Description →
    - What’s changed
    - Why it’s needed
    - Screenshots/gifs if applicable

#### 5. Self-review the PR
Even solo:
- Read the diff like it’s someone else’s code.
- Catch typos, small bugs, or messy code before merging.

#### 6. Merge PR → dev
- Squash merge → Combines commits into one clean commit in dev
- Merge commit → Preserves individual commits

#### 7. Test dev
Run and test the app to ensure stability before release.

#### 8. Merge dev → main (Release)
```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```
Or create a GitHub PR for visibility.

#### 9. Tag releases (optional but recommended)
```bash
git tag -a v1.0.0 -m "First stable release"
git push origin v1.0.0
```