
import React from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Results() {
  const router = useRouter();
  
  // This would be loaded from API in a real app
  // For demo, we'll just show mock data
  const ingredients = ['eggs', 'bacon', 'cheese'];
  const recipes = [
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
    }
  ];
  
  // Group recipes by cuisine type
  const recipesByCuisine = {};
  recipes.forEach(recipe => {
    const cuisine = recipe.cuisineType || 'Other';
    if (!recipesByCuisine[cuisine]) {
      recipesByCuisine[cuisine] = [];
    }
    recipesByCuisine[cuisine].push(recipe);
  });

  return (
    <div>
      <Head>
        <title>Recipe Suggestions</title>
        <meta name="description" content="Recipe suggestions based on your ingredients" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css" />
      </Head>

      <div className="container my-5">
        <div className="row justify-content-center">
          <div className="col-md-10">
            <div className="card shadow">
              <div className="card-header bg-primary text-white">
                <h1 className="text-center mb-0">Recipe Suggestions</h1>
              </div>
              <div className="card-body">
                <div className="row mb-4">
                  <div className="col-md-12">
                    <div className="card mb-3">
                      <div className="card-header bg-secondary text-white">
                        <h3 className="mb-0">Detected Ingredients</h3>
                      </div>
                      <div className="card-body">
                        <div className="ingredient-tags">
                          {ingredients.map((ingredient, index) => (
                            <div key={index} className="ingredient-tag">{ingredient}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <h2 className="mb-4 text-center">Recipe Ideas by Cuisine</h2>

                {Object.keys(recipesByCuisine).map((cuisine, cuisineIndex) => (
                  <div className="mb-4" key={cuisineIndex}>
                    <h3>{cuisine} Cuisine</h3>
                    <div className="row">
                      {recipesByCuisine[cuisine].map((recipe, index) => (
                        <div className="col-md-6 mb-4" key={index}>
                          <div className="card h-100">
                            <div className={`card-header bg-${index % 2 === 0 ? 'info' : 'success'} text-white`}>
                              <h4 className="mb-0">{recipe.name}</h4>
                            </div>
                            <div className="card-body">
                              <div className="mb-3">
                                <span className="badge bg-secondary">{recipe.difficulty}</span>
                                <span className="badge bg-info ms-1">{recipe.cookingTime}</span>
                              </div>

                              <h5>Ingredients:</h5>
                              <ul>
                                {recipe.ingredients.map((ingredient, i) => (
                                  <li key={i}>
                                    {ingredient}
                                    {ingredients.some(ing => ingredient.toLowerCase().includes(ing.toLowerCase())) && (
                                      <span className="badge bg-success ms-1">✓</span>
                                    )}
                                  </li>
                                ))}
                              </ul>

                              <h5>Instructions:</h5>
                              <p style={{whiteSpace: 'pre-line'}}>{recipe.instructions}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="text-center mt-4">
                  <Link href="/" className="btn btn-primary">
                    Try Again
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
