#!/bin/bash
# Helper script to add Gemini API key to .env

echo "🔑 Gemini API Key Setup"
echo ""
echo "Please enter your Gemini API key:"
echo "(Get it from: https://aistudio.google.com/app/apikey)"
echo ""
read -s API_KEY

if [ -z "$API_KEY" ]; then
  echo "❌ No API key provided"
  exit 1
fi

# Update .env file
cat > .env << ENVFILE
# Google Gemini API Key
# Get your API key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=$API_KEY
ENVFILE

echo ""
echo "✅ API key added to .env file"
echo "   Preview: ${API_KEY:0:10}...${API_KEY: -4}"
