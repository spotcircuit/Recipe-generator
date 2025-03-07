
#!/bin/bash

# Create a tar.gz archive of the entire project
echo "Creating tar.gz archive of your Recipe Generator project..."
tar -czvf recipe-generator.tar.gz \
    index.js \
    package.json \
    package-lock.json \
    .env \
    public/ \
    views/ \
    README.md

echo "Export complete! You can now download recipe-generator.tar.gz from the file browser."
