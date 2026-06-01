#!/bin/bash

# Configuration
HF_SPACE_URL="https://huggingface.co/spaces/rexhoh/tender-inquiry"

echo "🚀 Starting Deployment Process to Hugging Face: rexhoh/tender-inquiry"

# 1. Configure Remote
echo "🔗 Configuring remote 'space'..."
if git remote | grep -q "^space$"; then
    git remote set-url space $HF_SPACE_URL
else
    git remote add space $HF_SPACE_URL
fi
echo "✅ Remote 'space' set to $HF_SPACE_URL"

# 2. Sync with Origin (Backups)
echo "📦 Pulling latest changes from origin..."
git pull origin main

# 3. Stage & Commit
echo "📝 Staging files..."
git add .
if git diff-index --quiet HEAD --; then
    echo "✅ No changes to commit."
else
    read -p "Enter commit message (default: 'Update deployment'): " commit_msg
    commit_msg=${commit_msg:-"Update deployment"}
    git commit -m "$commit_msg"
fi

# 4. Push to Backup (GitHub)
echo "☁️ Pushing to GitHub (origin)..."
git push origin main

# 5. Push to Hugging Face
echo "🚀 Deploying to Hugging Face Spaces..."
echo "⚠️  NOTE: If asked for Username/Password:"
echo "   - Username: rexhoh"
echo "   - Password: Your Hugging Face Access Token (Write/Role)"
echo "   (Input will be hidden, just paste and press Enter)"
git push space main

echo "🎉 Deployment command finished. Check: $HF_SPACE_URL"
