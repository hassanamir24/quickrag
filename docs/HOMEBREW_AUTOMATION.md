# Homebrew Formula Automation

The Homebrew formula is automatically updated when a new release is created via GitHub Actions.

## Setup

To enable automatic updates, you need to create a GitHub Personal Access Token (PAT) with write access to the `statico/homebrew-quickrag` repository and add it as a secret:

1. Create a GitHub Personal Access Token:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a name like "Homebrew Tap Updater"
   - Select the `repo` scope (or at minimum, `public_repo` if the tap is public)
   - Generate the token and copy it

2. Add the token as a repository secret:
   - Go to your repository settings: https://github.com/statico/quickrag/settings/secrets/actions
   - Click "New repository secret"
   - Name: `HOMEBREW_TAP_TOKEN`
   - Value: Paste your PAT
   - Click "Add secret"

## How It Works

When you create a new release (via `npm version` and `git tag`), the GitHub Actions workflow will:

1. Build binaries for all platforms
2. Create a GitHub release with the binaries
3. Automatically update the Homebrew formula in `statico/homebrew-quickrag`:
   - Updates the version number
   - Updates the URL to point to the new release tag
   - Commits and pushes the changes

## Manual Update (if automation fails)

If automation fails or the secret is not set, you can manually update the formula:

```bash
cd /opt/homebrew/Library/Taps/statico/homebrew-quickrag
# Edit quickrag.rb to update version and URL
git add quickrag.rb
git commit -m "chore(homebrew): update formula to vX.Y.Z"
git push
```
