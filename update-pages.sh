#!/bin/bash

# List of files to update
FILES=(
  "src/app/page.tsx"
  "src/app/analytics/page.tsx"
  "src/app/profile/page.tsx"
  "src/app/profile/[username]/page.tsx"
  "src/app/pay/[username]/page.tsx"
)

# For each file, perform the necessary replacements
for file in "${FILES[@]}"; do
  echo "Updating $file..."
  
  # Replace import statement
  sed -i '' 's/import { Providers } from.*$/import { PageWrapper } from "\@\/components\/layouts\/PageWrapper";/g' "$file"
  
  # Replace <Providers> with <PageWrapper> in JSX
  sed -i '' 's/<Providers>/<PageWrapper>/g' "$file"
  sed -i '' 's/<\/Providers>/<\/PageWrapper>/g' "$file"
  
  echo "Done updating $file"
done

echo "All files updated successfully!" 