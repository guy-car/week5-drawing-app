#!/bin/bash

# Create fonts directory if it doesn't exist
mkdir -p assets/fonts

# Download Exo 2 fonts from Google Fonts
curl -L "https://fonts.google.com/download?family=Exo%202" -o exo2.zip

# Unzip and move only the fonts we need
unzip -j exo2.zip "static/Exo2-Light.ttf" "static/Exo2-Regular.ttf" "static/Exo2-MediumItalic.ttf" -d assets/fonts/

# Clean up
rm exo2.zip

echo "Fonts downloaded successfully!" 