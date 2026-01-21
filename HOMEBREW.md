# Homebrew Installation Guide

This guide explains how to set up QuickRAG as a Homebrew tap for easy installation.

## Option 1: Create Your Own Tap Repository (Recommended)

### Step 1: Create the Tap Repository

1. Create a new GitHub repository named `homebrew-quickrag` (or `homebrew-<your-username>`)
   - The repository name must start with `homebrew-`
   - Make it public (Homebrew requires public taps)

2. Copy the formula file:
   ```sh
   # From the quickrag repository
   cp Formula/quickrag.rb /path/to/homebrew-quickrag/quickrag.rb
   ```

3. Edit the formula file to update:
   - `homepage`: Your GitHub repository URL
   - `url`: The release or source URL
   - Replace `YOUR_USERNAME` with your actual GitHub username

### Step 2: Push to GitHub

```sh
cd /path/to/homebrew-quickrag
git init
git add quickrag.rb
git commit -m "Add quickrag formula"
git remote add origin https://github.com/YOUR_USERNAME/homebrew-quickrag.git
git push -u origin main
```

### Step 3: Users Can Install

Users can now install QuickRAG with:

```sh
brew tap YOUR_USERNAME/quickrag
brew install quickrag
```

## Option 2: Install Directly from Formula

Users can install directly from the formula file in this repository:

```sh
brew install --build-from-source /path/to/quickrag/Formula/quickrag.rb
```

Or if the formula is hosted online:

```sh
brew install https://raw.githubusercontent.com/YOUR_USERNAME/quickrag/main/Formula/quickrag.rb
```

## Formula Details

The Homebrew formula:
- Depends on `bun` (installed automatically)
- Installs all source files to `libexec`
- Creates a wrapper script in `bin/quickrag` that runs the TypeScript file with Bun
- Automatically creates the config directory on installation

## Updating the Formula

When releasing a new version:

1. Update the `version` field in `Formula/quickrag.rb`
2. Update the `url` to point to the new release (if using releases)
3. Commit and push the changes
4. Users can update with: `brew upgrade quickrag`

## Testing the Formula

Test the formula locally:

```sh
brew install --build-from-source Formula/quickrag.rb
brew test quickrag
```

## Troubleshooting

**Issue: "No available formula"**
- Make sure the tap repository name starts with `homebrew-`
- Ensure the repository is public
- Check that the formula file is named correctly (`quickrag.rb`)

**Issue: "bun: command not found"**
- The formula should install bun automatically
- If not, install manually: `brew install bun`

**Issue: Permission errors**
- Make sure the formula has execute permissions
- Try: `chmod +x Formula/quickrag.rb` (though this shouldn't be necessary)
