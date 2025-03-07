const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Check environment variables
console.log("Environment check:");
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
console.log("OPEN_API_KEY exists:", !!process.env.OPEN_API_KEY);

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Static files
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Initialize OpenAI client
let openai = null;
try {
  if (process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY) {
    const OpenAI = require("openai");
    openai = new OpenAI({
      apiKey: process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY
    });
    console.log("OpenAI client initialized successfully");
  } else {
    console.warn("OpenAI API key not found in environment variables");
  }
} catch (error) {
  console.error("Error initializing OpenAI:", error);
}

// Analyze image using OpenAI Vision API (from original code)
async function analyzeImage(imagePath) {
  try {
    // Check if API key exists
    if (!process.env.OPEN_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error('OpenAI API Key not found in .env file');
      throw new Error('OpenAI API Key not configured. Please add OPEN_API_KEY to your .env file.');
    }

    // Read the image as base64
    const imageFile = fs.readFileSync(imagePath);
    const base64Image = Buffer.from(imageFile).toString('base64');

    console.log("Sending image to OpenAI for analysis...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a food detection expert. Return ONLY ingredient names, separated by commas."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "List ALL food ingredients visible in this image." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      max_tokens: 400
    });

    // Extract detected ingredients from the response
    const detectionText = response.choices[0].message.content;
    console.log("OpenAI Food Detection Result:", detectionText);

    // Parse the detection text into an array of ingredients
    let detectedIngredients = detectionText
      .split(/[\n,•\-]+/)
      .map(item => item.trim())
      .filter(item => item && item.length > 1);

    return detectedIngredients;
  } catch (error) {
    console.error('Error analyzing image with OpenAI:', error);
    return ['bacon', 'eggs', 'cheese', 'bread']; // Fallback
  }
}

// Generate recipe ideas based on ingredients using OpenAI (from original code)
async function generateRecipes(ingredients, cuisineTypes = []) {
  try {
    // Ensure ingredients is an array
    if (!Array.isArray(ingredients)) {
      ingredients = String(ingredients).split(',').map(item => item.trim());
    }

    // Filter out empty ingredients
    ingredients = ingredients.filter(item => item && item.trim() !== '');

    if (ingredients.length === 0) {
      throw new Error("No valid ingredients provided");
    }

    // Format ingredients into a comma-separated string
    const ingredientList = ingredients.join(', ');

    // Default to various cuisine types if none specified
    if (!cuisineTypes || cuisineTypes.length === 0) {
      cuisineTypes = ['American', 'Italian', 'Mexican'];
    }

    // Normalize cuisine type capitalization to ensure consistency
    cuisineTypes = cuisineTypes.map(type => {
      // Convert to title case for display
      return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    });

    console.log("Normalized cuisine types:", JSON.stringify(cuisineTypes));
    console.log("Using ingredients:", JSON.stringify(ingredients));

    // Create prompt for OpenAI based on cuisine types
    let prompt = `Create recipe ideas using these ingredients: ${ingredientList}.\n\n`;

    // Add cuisine-specific instructions with more specific guidance for special cuisines
    prompt += `For each of the following cuisine types: ${cuisineTypes.join(', ')}, create 3 unique recipes.\n`;

    // Add special handling for specific cuisine types
    if (cuisineTypes.some(type => type.toLowerCase() === 'asian')) {
      prompt += `For Asian cuisine, include authentic recipes from various Asian traditions such as Chinese, Japanese, Korean, Thai, or Vietnamese.\n`;
    }

    if (cuisineTypes.some(type => type.toLowerCase() === 'greek')) {
      prompt += `For Greek cuisine, include authentic Mediterranean dishes with ingredients like olive oil, feta cheese, yogurt, and traditional Greek herbs and spices.\n`;
    }

    if (cuisineTypes.some(type => type.toLowerCase() === 'mediterranean')) {
      prompt += `For Mediterranean cuisine, focus on fresh ingredients, olive oil, herbs, and dishes from countries around the Mediterranean Sea like Greece, Italy, Spain, and Lebanon.\n`;
    }

    console.log("Generating recipes with prompt:", prompt);

    // Check if OpenAI client is available
    if (!openai) {
      console.log("OpenAI client not available, using fallback recipes");
      return createFallbackRecipes(ingredients);
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional chef specializing in global cuisines." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      // Extract and parse the response
      const content = response.choices[0].message.content;

      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (apiError) {
      console.error("Error calling OpenAI API:", apiError);
      return createFallbackRecipes(ingredients);
    }

    // Fallback
    return [
      {
        name: `${ingredients[0]} Recipe`,
        cuisineType: cuisineTypes[0],
        ingredients: [...ingredients, 'salt', 'pepper'],
        instructions: "Cook all ingredients together.",
        cookingTime: "30 minutes",
        difficulty: "Easy"
      }
    ];
  } catch (error) {
    console.error("Error generating recipes:", error);
    return [
      {
        name: `Simple ${ingredients[0]} Dish`,
        cuisineType: cuisineTypes[0] || "American",
        ingredients: [...ingredients, 'salt', 'pepper'],
        instructions: "Combine all ingredients and cook until done.",
        cookingTime: "20 minutes",
        difficulty: "Easy"
      }
    ];
  }
}


// Routes
app.get('/', (req, res) => {
  res.render('local-index');
});

app.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    // Initialize variables
    let imagePath = '';
    let ingredients = [];
    let imagePathForDisplay = null;

    // Determine input method and process accordingly
    const isTextInput = req.body.inputMethod === 'text';
    const isImageInput = req.body.inputMethod === 'image' && req.file;

    console.log("Input method:", req.body.inputMethod);
    console.log("Has text input:", isTextInput);
    console.log("Has image input:", isImageInput);
    console.log("Text ingredients:", req.body.ingredients);

    if (isTextInput && req.body.ingredients) {
      // Process text input
      ingredients = req.body.ingredients.split(',').map(item => item.trim());
      console.log("Using text input with ingredients:", ingredients);
    } 
    else if (req.body.inputMethod === 'text') {
      // Process text input - ensure we handle the ingredients correctly
      if (req.body.ingredients) {
        ingredients = req.body.ingredients.split(',').map(item => item.trim());
        console.log("Using text input with ingredients:", ingredients);
      } else {
        console.error("Text input selected but no ingredients provided");
        throw new Error("Please provide ingredients in the text field.");
      }
    }
    else if (isImageInput) {
      // Process image input
      imagePath = path.join(__dirname, 'public', 'uploads', req.file.filename);
      ingredients = await analyzeImage(imagePath);
      imagePathForDisplay = `/uploads/${path.basename(imagePath)}`;
      console.log("Using image input with ingredients:", ingredients);
    } 
    else {
      // No valid input provided
      console.error("No valid input method detected");
      throw new Error("Please provide either ingredients text or an image.");
    }

    // Validate ingredients
    if (!ingredients || ingredients.length === 0) {
      throw new Error("No ingredients detected. Please try again with clearer input.");
    }

    // Get selected cuisines
    const cuisines = Array.isArray(req.body.cuisines) ? req.body.cuisines : 
                    (req.body.cuisines ? [req.body.cuisines] : []);

    console.log("Selected cuisines:", cuisines);

    // Generate recipes based on ingredients
    const recipes = await generateRecipes(ingredients, cuisines);

    // Render the results page
    res.render('results', { 
      ingredients: ingredients, 
      recipes: recipes, 
      imagePath: imagePathForDisplay,
      isLocalMode: true
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(`Error processing request: ${error.message}`);
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log(`Upload directory: ${path.join(__dirname, 'public/uploads')}`);
  console.log(`OpenAI API Key status: ${process.env.OPEN_API_KEY ? 'Configured ✓' : 'Missing ✗'}`);
  console.log(`Access your app at: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);

  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, 'public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
  }
});
// Fallback recipe generator if OpenAI API fails
function createFallbackRecipes(ingredients) {
  // Ensure ingredients is properly formatted
  if (!Array.isArray(ingredients)) {
    ingredients = String(ingredients).split(',').map(item => item.trim());
  }

  // Filter out any empty ingredients
  ingredients = ingredients.filter(item => item && item.trim() !== '');

  // Fallback to some defaults if no valid ingredients
  if (ingredients.length === 0) {
    ingredients = ['eggs', 'cheese', 'bread'];
  }

  const ingredientName = ingredients[0].charAt(0).toUpperCase() + ingredients[0].slice(1);

  const recipes = [];

  // Create a basic recipe for each cuisine type
  const cuisineTypes = ['American', 'Italian', 'Mexican'];

  cuisineTypes.forEach((cuisine, index) => {
    let recipeName, instructions;
    const baseIngredients = [...ingredients, 'salt', 'pepper', 'olive oil'];

    switch (cuisine) {
      case 'American':
        recipeName = `Classic ${ingredientName} Dish`;
        baseIngredients.push('garlic powder', 'onion');
        instructions = `1. Prepare all ingredients.\n2. Heat olive oil in a pan.\n3. Combine ${ingredients.join(', ')} in the pan.\n4. Season with salt, pepper, and garlic powder.\n5. Cook until done, stirring occasionally.\n6. Serve hot.`;
        break;
      case 'Italian':
        recipeName = `${ingredientName} Italiano`;
        baseIngredients.push('basil', 'garlic', 'tomatoes');
        instructions = `1. Chop all ingredients.\n2. Heat olive oil in a pan.\n3. Sauté garlic until fragrant.\n4. Add tomatoes and cook for 5 minutes.\n5. Add ${ingredients.join(', ')} and simmer.\n6. Finish with fresh basil and serve.`;
        break;
      case 'Mexican':
        recipeName = `${ingredientName} Fiesta`;
        baseIngredients.push('cilantro', 'lime', 'chili powder');
        instructions = `1. Prepare the ingredients.\n2. Heat oil in a pan.\n3. Add ${ingredients.join(', ')} and cook thoroughly.\n4. Season with salt, pepper, and chili powder.\n5. Finish with fresh lime juice and cilantro.\n6. Serve with your favorite side dishes.`;
        break;
    }

    recipes.push({
      name: recipeName,
      cuisineType: cuisine,
      ingredients: baseIngredients,
      instructions: instructions,
      cookingTime: `${15 + (index * 5)} minutes`,
      difficulty: "Easy"
    });
  });

  return recipes;
}