
export default function handler(req, res) {
  // In a real app, this would connect to OpenAI or another service
  // For now, we'll return mock data
  
  const { ingredients, cuisineTypes } = req.body;
  
  const mockRecipes = [
    {
      name: "Breakfast Sandwich",
      cuisineType: "American",
      ingredients: ['egg', 'bacon', 'cheese', 'bread', 'salt', 'pepper', 'butter'],
      instructions: "1. Cook the bacon until crispy\n2. Fry the egg\n3. Toast the bread\n4. Assemble the sandwich with cheese\n5. Season with salt and pepper",
      cookingTime: "15 minutes",
      difficulty: "Easy"
    },
    {
      name: "Italian Frittata",
      cuisineType: "Italian",
      ingredients: ['egg', 'cheese', 'bread crumbs', 'basil', 'olive oil', 'salt', 'pepper'],
      instructions: "1. Beat eggs in a bowl\n2. Mix in cheese and herbs\n3. Cook on low heat in an oiled pan\n4. Sprinkle with bread crumbs\n5. Finish under the broiler",
      cookingTime: "20 minutes",
      difficulty: "Medium"
    },
    {
      name: "Mexican Breakfast Burrito",
      cuisineType: "Mexican",
      ingredients: ['egg', 'cheese', 'tortilla', 'salsa', 'avocado', 'beans'],
      instructions: "1. Scramble eggs with cheese\n2. Warm tortilla\n3. Fill with eggs, beans, and other ingredients\n4. Top with salsa and avocado\n5. Roll up and serve",
      cookingTime: "15 minutes",
      difficulty: "Easy"
    }
  ];
  
  // Filter by cuisine type if provided
  let filteredRecipes = mockRecipes;
  if (cuisineTypes && cuisineTypes.length > 0) {
    filteredRecipes = mockRecipes.filter(recipe => 
      cuisineTypes.includes(recipe.cuisineType.toLowerCase())
    );
  }
  
  res.status(200).json({ recipes: filteredRecipes });
}
