
# Recipe Generator - Local Setup

## Prerequisites
- Node.js installed on your machine
- NPM (Node Package Manager)

## Installation Steps

1. Extract the downloaded zip file to a folder on your computer

2. Open a terminal/command prompt and navigate to the extracted folder

3. Install the required dependencies:
   ```
   npm install
   ```

4. Start the local server:
   ```
   node local-setup.js
   ```

5. Open your web browser and go to:
   ```
   http://localhost:3000
   ```

## Features in the Simplified Local Version

This local version has been simplified to make it easier to use:

- Simple photo upload: Just select a photo and click one button
- Simple text input: Type ingredients separated by commas and get recipes
- No multi-step process - everything is one click away
- Mock recipe generation (no actual AI analysis)

Note: This simplified version removes the complicated multi-step UI from the original to make testing easier.

## Folder Structure

- `views/`: Contains the EJS templates for the app
- `public/`: Static files including CSS and uploaded images
- `local-setup.js`: Simplified server for local testing
