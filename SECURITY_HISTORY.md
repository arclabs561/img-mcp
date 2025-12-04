# Security: Git History Cleanup

## ⚠️ IMPORTANT: API Key in Git History

An API key was committed to git history in commit `7658213` (file: `CURSOR_CONFIG_FINAL.json`).

**If this was a real API key:**
1. **Rotate the key immediately** in Google Cloud Console
2. Revoke the old key
3. Update all local `.env` files with the new key

## Removing Secrets from Git History

### Option 1: Using git-filter-repo (Recommended)

```bash
# Install git-filter-repo
pip install git-filter-repo

# Create replacement file
cat > /tmp/replace.txt << EOF
AIzaSyAM6FE4xyyX0cGwam-AlVDSv3cr514OK9A==>your-api-key-here
EOF

# Remove from history
git filter-repo \
  --replace-text /tmp/replace.txt \
  --force

# Force push (WARNING: rewrites history)
git push origin --force --all
```

### Option 2: Using BFG Repo-Cleaner

```bash
# Install BFG
brew install bfg  # or download from https://rtyley.github.io/bfg-repo-cleaner/

# Create passwords file
echo "AIzaSyAM6FE4xyyX0cGwam-AlVDSv3cr514OK9A" > /tmp/passwords.txt

# Clean history
bfg --replace-text /tmp/passwords.txt

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

### Option 3: Start Fresh (Nuclear Option)

If the repository is new and has few commits:

```bash
# Create new orphan branch
git checkout --orphan clean-main

# Add all current files (without history)
git add .
git commit -m "Initial commit (cleaned history)"

# Replace main branch
git branch -D main
git branch -m main
git push origin main --force
```

## Prevention

- ✅ All example configs now use `"your-api-key-here"`
- ✅ `.env` files are in `.gitignore`
- ✅ CI checks for secrets in commits
- ✅ Pre-commit hooks can be added to prevent future commits

## Current Status

- ✅ API key removed from all current files
- ⚠️ API key still exists in git history (commit `7658213`)
- ✅ CI will fail if secrets are detected in new commits
- ✅ Security workflow scans history weekly

