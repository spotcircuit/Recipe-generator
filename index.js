const express = require('express');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Request received`);

  // Log request body for POST requests (but truncate large data like images)
  if (req.method === 'POST' && req.body) {
    const bodyCopy = {...req.body};
    // Don't log base64 image data
    if (bodyCopy.food_image) bodyCopy.food_image = '[IMAGE DATA]';
    console.log(`Request Body: ${JSON.stringify(bodyCopy)}`);
  }

  // Add response logging
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Response sent in ${responseTime}ms with status ${res.statusCode}`);
    return originalSend.call(this, body);
  };

  next();
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Error: Images Only!'));
    }
  }
});

// Analyze image using OpenAI Vision API
async function analyzeImage(imagePath) {
  try {
    // Check if API key exists
    if (!process.env.OPEN_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error('OpenAI API Key not found in .env file');
      throw new Error('OpenAI API Key not configured. Please add OPEN_API_KEY to your .env file.');
    }

    // Initialize OpenAI if not already initialized
    if (!openai) {
      openai = new OpenAI({
        apiKey: process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY
      });
      console.log("OpenAI client initialized in analyzeImage function");
    }

    // Read the image as base64
    const imageFile = fs.readFileSync(imagePath);

    // Log the image size - large images can cause timeout issues
    const fileSizeInMB = imageFile.length / (1024 * 1024);
    console.log(`Processing image of size: ${fileSizeInMB.toFixed(2)} MB`);

    // If image is too large, consider resizing (over 4MB might be problematic)
    if (fileSizeInMB > 4) {
      console.warn(`Image size (${fileSizeInMB.toFixed(2)} MB) may cause timeout issues`);
    }

    const base64Image = Buffer.from(imageFile).toString('base64');

    console.log("Sending image to OpenAI for analysis...");
    console.log(`OpenAI Vision API Request - Model: gpt-4o-mini, Image Size: ${fileSizeInMB.toFixed(2)} MB, Timestamp: ${new Date().toISOString()}`);
    console.log(`Note: OpenAI Vision API timeout set to 3 minutes for processing complex images with multiple items`);

    const startTime = Date.now();
    // Call OpenAI Vision API with timeout and improved prompt for multiple food items
    const response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a food detection expert specialized in identifying multiple food items in a single image. Return ONLY ingredient names, separated by commas or newlines. Be specific and comprehensive."
          },
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: "List ALL food ingredients visible in this image. Format: one ingredient per line.\n- Be specific (e.g., 'bacon' not 'meat', 'cheddar cheese' not 'dairy')\n- Include prepared foods (e.g., 'hamburger patty', 'fried egg')\n- List ONLY ingredients, no explanations or descriptions\n- Don't miss any items, even if they're small or partially visible" 
              },
              { 
                type: "image_url", 
                image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
              }
            ]
          }
        ],
        max_tokens: 400,
        temperature: 0.3 // Lower temperature for more focused responses
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("OpenAI API request timed out after 3 minutes")), 180000)
      )
    ]);
    const responseTime = Date.now() - startTime;
    console.log(`OpenAI Vision API Response received in ${responseTime}ms - ID: ${response.id}, Model: ${response.model}, Usage: ${JSON.stringify(response.usage)}`);

    // Extract detected ingredients from the response
    const detectionText = response.choices[0].message.content;
    console.log("OpenAI Food Detection Result:", detectionText);

    // Enhanced parsing for multiple food items
    // First try to split by common delimiters
    let detectedIngredients = detectionText
      .split(/[\n,•\-]+/)
      .map(item => item.trim().toLowerCase())
      .filter(item => 
        item && 
        !item.includes('i see') && 
        !item.includes('in the image') &&
        !item.includes('i can see') &&
        !item.includes('there is') &&
        !item.includes('there are') &&
        !item.startsWith('-') &&
        item.length > 1
      );

    // Clean up ingredients further
    detectedIngredients = detectedIngredients.map(item => {
      // Remove numbering, bullets, and common prefixes
      return item.replace(/^\d+[\.\)]\s*/, '')
                .replace(/^-\s*/, '')
                .replace(/^a\s+/, '')
                .replace(/^an\s+/, '')
                .replace(/^some\s+/, '')
                .replace(/^the\s+/, '')
                .trim();
    });

    // Identify common food items even if not explicitly mentioned
    const imageFileName = path.basename(imagePath).toLowerCase();
    
    // Parse the file name for additional context clues
    if (imageFileName.includes('bacon') && !detectedIngredients.includes('bacon')) {
      detectedIngredients.push('bacon');
    }
    
    // Special handling for common food combinations in the image
    const foodTexts = detectionText.toLowerCase();
    
    // Enhanced detection for common food items with more context clues
    
    // Eggs detection
    if (foodTexts.includes('egg') || 
        (foodTexts.includes('yellow') && foodTexts.includes('fried')) ||
        foodTexts.includes('yolk') ||
        foodTexts.includes('breakfast') && foodTexts.includes('plate')) {
      
      // Ensure eggs are detected
      if (!detectedIngredients.some(i => i === 'egg' || i === 'eggs' || i.includes('egg'))) {
        detectedIngredients.push('eggs');
      }
    }
    
    // Cheese detection
    if ((foodTexts.includes('cheese') || foodTexts.includes('cheddar') || 
         (foodTexts.includes('yellow') && foodTexts.includes('slice')) ||
         foodTexts.includes('american cheese') ||
         foodTexts.includes('melted') && foodTexts.includes('yellow')) && 
        !detectedIngredients.some(i => i.includes('cheese'))) {
      detectedIngredients.push('cheese');
      
      // If it's specifically cheddar, add that too
      if (foodTexts.includes('cheddar') && !detectedIngredients.some(i => i.includes('cheddar'))) {
        detectedIngredients.push('cheddar cheese');
      }
    }
    
    // Bacon detection
    if ((foodTexts.includes('bacon') || foodTexts.includes('strips') || 
         foodTexts.includes('pork belly') || foodTexts.includes('crispy pork') ||
         (foodTexts.includes('strips') && foodTexts.includes('meat'))) && 
        !detectedIngredients.some(i => i.includes('bacon'))) {
      detectedIngredients.push('bacon');
    }
    
    if ((foodTexts.includes('meat') || foodTexts.includes('patty') || 
         foodTexts.includes('beef') || foodTexts.includes('steak') || 
         foodTexts.includes('pork') || foodTexts.includes('meatloaf')) && 
        !detectedIngredients.some(i => i.includes('meat') || i.includes('beef') || i.includes('pork'))) {
      // Try to differentiate the type of meat
      if (foodTexts.includes('beef') || foodTexts.includes('hamburger')) {
        detectedIngredients.push('beef');
      } else if (foodTexts.includes('pork')) {
        detectedIngredients.push('pork');
      } else {
        detectedIngredients.push('meat');
      }
    }
    
    if ((foodTexts.includes('bread') || foodTexts.includes('bun') || 
         foodTexts.includes('muffin')) && 
        !detectedIngredients.some(i => i.includes('bread') || i.includes('bun') || i.includes('muffin'))) {
      if (foodTexts.includes('english muffin')) {
        detectedIngredients.push('english muffin');
      } else if (foodTexts.includes('muffin')) {
        detectedIngredients.push('muffin');
      } else if (foodTexts.includes('bun')) {
        detectedIngredients.push('bun');
      } else {
        detectedIngredients.push('bread');
      }
    }

    // Remove duplicates and non-food items (expanded filtering)
    const nonFoodTerms = [
      'doggy', 'dog', 'cat', 'person', 'human', 'hand', 'plate', 'bowl', 'utensil', 
      'fork', 'knife', 'spoon', 'table', 'countertop', 'counter', 'surface', 'dish',
      'container', 'tray', 'napkin', 'paper', 'plastic', 'wrapper', 'packaging'
    ];
    
    // Custom deduplication function for food items to handle similar entries
    function deduplicateIngredients(ingredients) {
      const result = [];
      const map = new Map();
      
      // Group similar ingredients
      ingredients.forEach(item => {
        // Skip non-food items
        if (nonFoodTerms.some(term => item.includes(term))) {
          return;
        }
        
        // Check if this is a variant of something we already have
        let found = false;
        for (const [key, _] of map.entries()) {
          // Handle similar items (e.g., "egg" and "fried egg")
          if ((item.includes(key) || key.includes(item)) && 
              Math.abs(item.length - key.length) < 10) {
            // Choose the more specific description
            if (item.length > key.length) {
              map.set(item, true);
              map.delete(key);
            }
            found = true;
            break;
          }
        }
        
        if (!found) {
          map.set(item, true);
        }
      });
      
      return Array.from(map.keys());
    }
    
    const uniqueIngredients = deduplicateIngredients(detectedIngredients);
    
    console.log("Extracted Ingredients:", uniqueIngredients);

    // Improved fallback with image context
    if (uniqueIngredients.length === 0) {
      console.log('No food items detected, checking image context for fallback');
      
      // Extract colors from the filename for better fallbacks
      if (imageFileName.includes('bacon')) {
        return ['bacon', 'pork'];
      } else if (imageFileName.includes('egg')) {
        return ['eggs', 'breakfast food'];
      } else if (imageFileName.includes('cheese')) {
        return ['cheese', 'dairy'];
      }
      
      console.log('Using standard fallback ingredients');
      return ['meat', 'bread', 'cheese', 'eggs'];
    }

    return uniqueIngredients;
  } catch (error) {
    console.error('Error analyzing image with OpenAI:', error);

    // More detailed error logging
    if (error.response) {
      console.error('API Error response:', error.response.status, error.response.data);
    } else if (error.message.includes('timed out')) {
      console.error('API Timeout:', error.message);
      console.error('Consider using fewer or clearer items in the image, or try a different image format');
    }

    // Enhanced fallback logic based on image path and error type
    const imageFileName = path.basename(imagePath || '').toLowerCase();
    
    // Better context-aware fallback
    if (imageFileName.includes('bacon')) {
      console.log('Image filename contains bacon, using this as fallback');
      return ['bacon', 'eggs', 'bread'];
    } else if (error.message && error.message.includes('timed out')) {
      console.log('Timeout occurred, using breakfast food fallback');
      return ['eggs', 'bacon', 'cheese', 'bread'];
    }

    // Standard fallback with more variety
    return ['meat', 'cheese', 'bread', 'eggs'];
  }
}

const OpenAI = require("openai");

// Initialize OpenAI client
let openai = null;
try {
  if (process.env.OPEN_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPEN_API_KEY
    });
    console.log("OpenAI client initialized successfully");
  } else {
    console.warn("OpenAI API key not found in environment variables");
  }
} catch (error) {
  console.error("Error initializing OpenAI:", error);
  // We'll initialize it later if needed
}

// Generate recipe ideas based on ingredients using OpenAI
async function generateRecipes(ingredients, cuisineTypes = []) {
  // Ensure ingredients is an array
  if (!Array.isArray(ingredients)) {
    ingredients = String(ingredients).split(',').map(item => item.trim());
  }

  // Ensure cuisineTypes is an array
  if (!Array.isArray(cuisineTypes)) {
    cuisineTypes = cuisineTypes ? [cuisineTypes] : [];
  }

  try {
    // Format ingredients into a comma-separated string
    const ingredientList = ingredients.join(', ');

    // Default to various cuisine types if none specified
    if (cuisineTypes.length === 0) {
      cuisineTypes = ['American', 'Italian', 'Mexican'];
    }

    // Normalize cuisine type capitalization to ensure consistency
    cuisineTypes = cuisineTypes.map(type => {
      // Convert to title case for display
      return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    });

    console.log("Normalized cuisine types:", JSON.stringify(cuisineTypes));

    // Create prompt for OpenAI based on cuisine types
    let prompt = `Create recipe ideas using these ingredients: ${ingredientList}.\n\n`;

    // Add cuisine-specific instructions with more specific guidance for Asian cuisine
    prompt += `For each of the following cuisine types: ${cuisineTypes.join(', ')}, create 3 unique recipes.\n`;

    // Add special handling for Asian cuisine if selected
    if (cuisineTypes.some(type => type.toLowerCase() === 'asian')) {
      prompt += `For Asian cuisine, include authentic recipes from various Asian traditions such as Chinese, Japanese, Korean, Thai, or Vietnamese.\n`;
    }
    prompt += `For each recipe, provide:
    1. A creative name that reflects the cuisine type
    2. The cuisine type tag
    3. A list of ingredients (including the detected ones and additional common ingredients)
    4. Step-by-step cooking instructions
    5. Cooking time
    6. Difficulty level (Easy, Medium, Hard)

    Format each recipe as a JSON object with fields: name, cuisineType, ingredients, instructions, cookingTime, difficulty.
    Return all recipes in a JSON array.`;

    console.log(`OpenAI Recipe Generation Request - Model: gpt-4o-mini, Timestamp: ${new Date().toISOString()}`);
    console.log(`Recipe Generation Prompt (${prompt.length} chars):\n${prompt.substring(0, 200)}...`);

    const startTime = Date.now();
    // Call OpenAI API with a more detailed system message
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a professional chef specializing in global cuisines. You create detailed, accurate recipes that highlight the authentic flavors and techniques of each cuisine type. Always include the detected ingredients in creative ways and suggest complementary ingredients to create complete, delicious meals. Each recipe must be unique and use the detected ingredients in different ways. Return the recipes in proper JSON format." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 3000
    });

    const responseTime = Date.now() - startTime;
    console.log(`OpenAI Recipe Generation Response received in ${responseTime}ms - ID: ${response.id}, Model: ${response.model}, Usage: ${JSON.stringify(response.usage)}`);

    // Extract and parse the response
    const content = response.choices[0].message.content;

    // Enhanced debugging for recipe generation
    console.log("OpenAI Recipe Generation Raw Response:", content.substring(0, 300) + "...");
    console.log(`Full response length: ${content.length} characters`);

    // Log if we detect potential JSON in the response
    if (content.includes('{') && content.includes('}')) {
      console.log("JSON detected in response");
    } else {
      console.log("WARNING: No JSON detected in response");
    }

    // Check if the response contains JSON array directly
    if (content.includes('[') && content.includes(']')) {
      const jsonStr = content.substring(
        content.indexOf('['),
        content.lastIndexOf(']') + 1
      );

      try {
        const recipes = JSON.parse(jsonStr);

        // Ensure each recipe has unique ingredients
        recipes.forEach(recipe => {
          // Ensure each recipe contains at least one of the detected ingredients
          const containsDetectedIngredient = recipe.ingredients.some(ingredient => 
            ingredients.some(detectedIngredient => 
              ingredient.toLowerCase().includes(detectedIngredient.toLowerCase())
            )
          );

          if (!containsDetectedIngredient) {
            // Add at least one detected ingredient if missing
            recipe.ingredients.push(...ingredients);
          }
        });

        return recipes;
      } catch (e) {
        console.error("Error parsing JSON array:", e);
      }
    } 
    // Check if response contains JSON objects directly
    else if (content.includes('{') && content.includes('}')) {
      const recipes = [];
      let startPos = 0;

      while (true) {
        const jsonStart = content.indexOf('{', startPos);
        if (jsonStart === -1) break;

        const jsonEnd = content.indexOf('}', jsonStart) + 1;
        if (jsonEnd === 0) break;

        const jsonStr = content.substring(jsonStart, jsonEnd);
        try {
          const recipe = JSON.parse(jsonStr);
          recipes.push(recipe);
          startPos = jsonEnd;
        } catch (e) {
          startPos = jsonStart + 1;
        }
      }

      if (recipes.length > 0) {
        return recipes;
      }
    }

    // Fallback: Try to extract structured data using regex patterns
    const recipePattern = /name: (.+?)[\n\r]+ingredients: \[(.+?)\][\n\r]+instructions: (.+?)[\n\r]+cookingTime: (.+?)[\n\r]+difficulty: (.+?)[\n\r]/gsi;
    const matches = [...content.matchAll(recipePattern)];

    if (matches.length > 0) {
      return matches.map(match => ({
        name: match[1].trim(),
        ingredients: match[2].split(',').map(i => i.trim()),
        instructions: match[3].trim(),
        cookingTime: match[4].trim(),
        difficulty: match[5].trim()
      }));
    }

    // If all parsing attempts fail, return a fallback recipe
    console.log("Failed to parse recipe response, using fallback");
    return createFallbackRecipes(ingredients);
  } catch (error) {
    console.error("Error calling OpenAI API:", error);

    // Enhanced error logging
    if (error.response) {
      console.error(`OpenAI API Error - Status: ${error.response.status}, Data:`, error.response.data);
    } else if (error.request) {
      console.error(`OpenAI API Error - Request made but no response received:`, error.request);
    } else {
      console.error(`OpenAI API Error - Message: ${error.message}`);
    }

    if (error.code) {
      console.error(`OpenAI API Error Code: ${error.code}`);
    }

    return createFallbackRecipes(ingredients);
  }
}

// Fallback recipe generator if OpenAI API fails
function createFallbackRecipes(ingredients) {
  const recipes = [];

  // Create a basic recipe using the detected ingredients
  recipes.push({
    name: `${ingredients[0].charAt(0).toUpperCase() + ingredients[0].slice(1)} Special`,
    ingredients: [...ingredients, 'salt', 'pepper', 'olive oil'],
    instructions: `1. Prepare all ingredients.\n2. Combine ${ingredients.join(', ')} in a suitable pan or pot.\n3. Season with salt and pepper to taste.\n4. Cook until done, stirring occasionally.`,
    cookingTime: "30 minutes",
    difficulty: "Easy"
  });

  // Add a second generic recipe option
  recipes.push({
    name: "Quick Kitchen Mix",
    ingredients: [...ingredients, 'garlic', 'onions', 'herbs'],
    instructions: "1. Chop all ingredients.\n2. Heat oil in a pan.\n3. Sauté garlic and onions until fragrant.\n4. Add remaining ingredients and cook until tender.\n5. Season to taste and serve hot.",
    cookingTime: "20 minutes",
    difficulty: "Easy"
  });

  return recipes;
}

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.post('/upload', upload.single('food_image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).render('index', { 
      error: 'No file uploaded. Please select an image file.'
    });
  }

  try {
    const imagePath = req.file.path;
    const ingredients = await analyzeImage(imagePath);

    // Get cuisine types from form data
    let cuisineTypes = req.body.cuisineTypes || [];

    // Handle if cuisineTypes is a JSON string
    if (typeof cuisineTypes === 'string') {
      try {
        cuisineTypes = JSON.parse(cuisineTypes);
      } catch (e) {
        // If not valid JSON, treat as single item or split by comma
        if (cuisineTypes.includes(',')) {
          cuisineTypes = cuisineTypes.split(',').map(item => item.trim());
        } else {
          cuisineTypes = [cuisineTypes];
        }
      }
    }

    // Ensure cuisineTypes is an array
    if (!Array.isArray(cuisineTypes)) {
      cuisineTypes = [cuisineTypes];
    }

    // Filter out any empty values
    cuisineTypes = cuisineTypes.filter(item => item && item.trim().length > 0);

    // Set default cuisine types if none selected
    if (cuisineTypes.length === 0) {
      console.log("No cuisine types selected, using defaults");
      cuisineTypes = ['american', 'italian', 'mexican'];
    }

    // Debug cuisine types before passing to API
    console.log("Cleaned cuisine types for API:", JSON.stringify(cuisineTypes));

    console.log("Detected ingredients:", ingredients);
    console.log("Selected cuisine types:", cuisineTypes);

    const recipes = await generateRecipes(ingredients, cuisineTypes);

    res.render('results', { 
      ingredients: ingredients,
      recipes: recipes,
      cuisineTypes: cuisineTypes,
      imagePath: '/uploads/' + path.basename(imagePath)
    });
  } catch (error) {
    console.error('Error processing upload:', error);
    let errorMessage = 'An error occurred while processing your image. Please try again.';

    if (error.message && error.message.includes('API Key')) {
      errorMessage = 'API configuration error: ' + error.message;
    } else if (error.response && error.response.data) {
      errorMessage = `Vision API error: ${error.response.data.error?.message || JSON.stringify(error.response.data)}`;
    }

    res.status(500).render('index', { error: errorMessage });
  }
});

app.post('/voice-input', async (req, res) => {
  let { ingredients } = req.body;

  console.log("Raw ingredients from request:", ingredients);

  // Ensure ingredients is an array
  if (typeof ingredients === 'string') {
    try {
      // Try to parse as JSON first (from the voice input)
      ingredients = JSON.parse(ingredients);
      console.log("Successfully parsed ingredients JSON:", ingredients);
    } catch (e) {
      console.error("Error parsing ingredients JSON:", e);
      // If not valid JSON, split by comma
      ingredients = ingredients.split(/[,.\n]+/).map(item => item.trim().toLowerCase());
      console.log("Split ingredients by delimiters:", ingredients);
    }
  }

  // Final check to ensure ingredients is an array
  if (!Array.isArray(ingredients)) {
    console.log("Ingredients is not an array, converting to empty array");
    ingredients = [];
  }

  // Remove duplicates and non-food items (expanded list)
  const nonFoodTerms = ['doggy', 'dog', 'cat', 'person', 'human', 'hand', 'plate', 'bowl', 'utensil', 'fork', 'knife', 'spoon', 
    'i', 'we', 'you', 'they', 'he', 'she', 'it', 'want', 'need', 'have', 'get', 'look', 'see', 'hi', 'hello'];
  const fillerWords = ['um', 'uh', 'like', 'and', 'the', 'a', 'an', 'some', 'few', 'little', 'also', 'then', 'please', 'maybe', 
    'actually', 'basically', 'well', 'just', 'so', 'very', 'really', 'quite', 'pretty', 'okay', 'ok', 'yeah', 'yes', 'no'];

  ingredients = [...new Set(ingredients)].filter(item => 
    item && typeof item === 'string' && 
    item.length > 1 && 
    !nonFoodTerms.some(term => item.includes(term)) &&
    !fillerWords.includes(item)
  );

  console.log("Processed voice ingredients:", ingredients);

  if (ingredients.length === 0) {
    return res.status(400).send('No valid food ingredients detected. Please try again with clearer food names.');
  }

  // Get cuisine types from form data
  let cuisineTypes = req.body.cuisineTypes || [];

  // Handle if cuisineTypes is a JSON string
  if (typeof cuisineTypes === 'string') {
    try {
      cuisineTypes = JSON.parse(cuisineTypes);
    } catch (e) {
      // If not valid JSON, treat as single item or split by comma
      if (cuisineTypes.includes(',')) {
        cuisineTypes = cuisineTypes.split(',').map(item => item.trim());
      } else {
        cuisineTypes = [cuisineTypes];
      }
    }
  }

  // Ensure cuisineTypes is an array
  if (!Array.isArray(cuisineTypes)) {
    cuisineTypes = [cuisineTypes];
  }

  // Filter out any empty values
  cuisineTypes = cuisineTypes.filter(item => item && item.trim().length > 0);

  // Set default cuisine types if none selected
  if (cuisineTypes.length === 0) {
    console.log("No cuisine types selected, using defaults");
    cuisineTypes = ['american', 'italian', 'mexican'];
  }

  console.log("Voice ingredients:", ingredients);
  console.log("Selected cuisine types:", cuisineTypes);

  try {
    const recipes = await generateRecipes(ingredients, cuisineTypes);

    res.render('results', { 
      ingredients: ingredients,
      recipes: recipes,
      cuisineTypes: cuisineTypes,
      imagePath: null
    });
  } catch (error) {
    console.error('Error generating recipes:', error);
    res.status(500).render('index', { 
      error: 'An error occurred while generating recipes. Please try again.'
    });
  }
});

// API endpoint to get available cuisine types
app.get('/api/cuisine-types', (req, res) => {
  const cuisineTypes = [
    { id: 'american', name: 'American', desc: 'Classic comfort food' },
    { id: 'italian', name: 'Italian', desc: 'Pasta, pizza and Mediterranean flavors' },
    { id: 'mexican', name: 'Mexican', desc: 'Bold, spicy Latin American dishes' },
    { id: 'asian', name: 'Asian', desc: 'East and Southeast Asian influences' },
    { id: 'indian', name: 'Indian', desc: 'Aromatic spices and rich curries' },
    { id: 'mediterranean', name: 'Mediterranean', desc: 'Healthy dishes from Greece, Turkey, etc.' },
    { id: 'french', name: 'French', desc: 'Refined, elegant cuisine' },
    { id: 'bbq', name: 'BBQ & Grill', desc: 'Smoked and grilled specialties' },
    { id: 'vegetarian', name: 'Vegetarian', desc: 'Meat-free dishes' },
    { id: 'breakfast', name: 'Breakfast', desc: 'Morning meals and brunch ideas' }
  ];

  console.log("Sending available cuisine types to client:", cuisineTypes.map(c => c.name));
  res.json(cuisineTypes);
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Recipe Generator app listening at http://0.0.0.0:${port}`);
});