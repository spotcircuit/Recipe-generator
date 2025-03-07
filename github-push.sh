
#!/bin/bash

# Script to push the Recipe Generator project to GitHub
echo "Pushing Recipe Generator to GitHub..."

# Ensure uploads directory exists with .gitkeep to maintain directory structure
# while ignoring actual uploaded files (as specified in .gitignore)
mkdir -p public/uploads
touch public/uploads/.gitkeep

# Create comprehensive .gitignore
cat > .gitignore << 'EOL'
# Node.js dependencies
node_modules/
jspm_packages/

# Environment variables
.env
.env.local
.env.*

# Large files and assets directories
*.tar.gz
*.tgz
*.zip
*.rar
*.7z
attached_assets/
attached_assets/*
public/uploads/*
recipe-generator*.tar.gz

# Only keep the .gitkeep file in uploads
!public/uploads/.gitkeep

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build directories
build/
dist/
.next/
out/

# Replit specific
.replit
replit.nix
.breakpoints
EOL

# Ensure git is initialized
if [ ! -d .git ]; then
  git init
  echo "Git repository initialized"
fi

# Set git config if not already set
if [ -z "$(git config --get user.email)" ]; then
  git config --global user.email "you@example.com"
  git config --global user.name "Your Name"
fi

# Remove remote if it exists
git remote rm origin 2>/dev/null

# Add the remote
git remote add origin https://github.com/spotcircuit/Recipe-generator.git
echo "GitHub remote URL set"

# Create a fresh git repository to eliminate history with large files
echo "Creating fresh repository to eliminate large files from history..."
rm -rf .git
git init

# Configure git
git config user.email "you@example.com"
git config user.name "Your Name"

# Add back the remote
git remote add origin https://github.com/spotcircuit/Recipe-generator.git

# Delete large files if they exist
rm -f recipe-generator*.tar.gz

# Remove attached_assets directory completely
rm -rf attached_assets

# Add all files (respecting .gitignore)
git add .

# Commit changes
echo "Committing changes..."
git commit -m "Upload Recipe Generator project"

# Force push to github
echo "Pushing to GitHub..."
git push -f origin main

echo "Process completed. Check output for any errors."
