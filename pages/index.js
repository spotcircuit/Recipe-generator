import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  // State management for the application
  const [activeMethod, setActiveMethod] = useState('camera');
  const [ingredients, setIngredients] = useState([]);
  const [voiceText, setVoiceText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [cuisineTypes, setCuisineTypes] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showCapturedImage, setShowCapturedImage] = useState(false);
  const [error, setError] = useState('');

  // References
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Effect to load cuisine types
  useEffect(() => {
    // These would come from API in production
    const defaultCuisineTypes = [
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
    setCuisineTypes(defaultCuisineTypes);
  }, []);

  // Function to handle cuisine selection
  const toggleCuisine = (cuisineId) => {
    setSelectedCuisines(prev => {
      if (prev.includes(cuisineId)) {
        return prev.filter(id => id !== cuisineId);
      } else {
        return [...prev, cuisineId];
      }
    });
  };

  // Camera functionality
  const startCamera = async () => {
    try {
      console.log("Starting camera...");
      
      // Log device type for debugging
      console.log("Device detected:", /Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop");
      
      // Define constraints with facingMode correctly
      const constraints = { 
        video: { 
          facingMode: "environment", // Simplified - don't use ideal which can sometimes be ignored
          width: { ideal: 1280 },
          height: { ideal: 720 } 
        }, 
        audio: false 
      };

      // First explicitly check for permissions (this can trigger the permission prompt)
      if (navigator.permissions && navigator.permissions.query) {
        try {
          await navigator.permissions.query({ name: 'camera' });
        } catch (e) {
          // Some browsers don't support this specific permission check
          console.log("Permission check not supported, continuing with getUserMedia");
        }
      }
      
      // Always attempt to get user media (this will trigger permission dialog if needed)
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setError('');
        
        // Set key attributes for cross-browser compatibility
        videoRef.current.setAttribute('playsinline', true);
        videoRef.current.setAttribute('autoplay', true);
        videoRef.current.setAttribute('muted', true);
        
        // Ensure video plays
        videoRef.current.play().catch(e => {
          console.error("Error playing video after permissions granted:", e);
        });
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      let errorMessage = "Camera access error: " + (err.name || "Unknown error");
      if (err.name === "NotAllowedError") {
        errorMessage = "Camera access denied. Please grant camera permissions in your browser settings.";
      } else if (err.name === "NotFoundError") {
        errorMessage = "No camera found on your device.";
      } else if (err.name === "NotReadableError") {
        errorMessage = "Camera is already in use by another application.";
      }
      setError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas dimensions to match the video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current video frame on the canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert the canvas to an image data URL
      const imageDataURL = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageDataURL);
      setShowCapturedImage(true);

      // Stop the camera after capturing
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setShowCapturedImage(false);
    startCamera();
  };

  const changeMethod = (method) => {
    setActiveMethod(method);
    if (method === 'camera') {
      // Clear any previous errors
      setError('');
      
      // Explicitly tell the user we're requesting camera access
      setError('Please allow camera access when prompted by your browser.');
      
      // Immediately request camera permissions when camera button is clicked
      setTimeout(() => {
        startCamera();
      }, 300); // Increased timeout to ensure UI is ready
    } else {
      stopCamera();
    }
  };

  // Effect to cleanup camera when component unmounts
  useEffect(() => {    
    // Cleanup function to stop camera when component unmounts
    return () => {
      stopCamera();
    };
  }, []);

  const handleTextInput = (e) => {
    setVoiceText(e.target.value);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // For now, just simulate the basic functionality
    // In a real app, this would make a fetch call to an API

    if (activeMethod === 'text' || activeMethod === 'voice') {
      if (!voiceText.trim()) {
        setError('Please enter some ingredients.');
        return;
      }

      // Parse the text input into ingredients
      const parsedIngredients = voiceText
        .split(/[,\n]+/)
        .map(item => item.trim())
        .filter(item => item.length > 0);

      setIngredients(parsedIngredients);
      // In a real app, here you would navigate to results page or fetch recipes
      alert(`Ingredients submitted: ${parsedIngredients.join(', ')}`);
    } 
    else if (activeMethod === 'camera') {
      if (!capturedImage) {
        setError('Please capture an image first.');
        return;
      }

      // In a real app, here you would send the image for processing
      alert('Image submitted for processing!');
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Recipe Generator</title>
        <meta name="description" content="AI-powered recipe generator" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css" />
      </Head>

      <main className={styles.main}>
        <div className="container my-5">
          <div className="row justify-content-center">
            <div className="col-md-8">
              <div className="card shadow">
                <div className="card-header bg-primary text-white">
                  <h1 className="text-center mb-0">Recipe Generator</h1>
                </div>
                <div className="card-body">
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      {error}
                    </div>
                  )}

                  <h4 className="text-center mb-4">How would you like to input ingredients?</h4>

                  <div className="row mb-4">
                    <div className="col-4 text-center">
                      <button 
                        className={`btn ${activeMethod === 'camera' ? 'btn-primary' : 'btn-outline-secondary'} w-100`}
                        onClick={() => changeMethod('camera')}
                      >
                        <i className="bi bi-camera"></i><br/>Camera
                      </button>
                    </div>
                    <div className="col-4 text-center">
                      <button 
                        className={`btn ${activeMethod === 'text' ? 'btn-primary' : 'btn-outline-secondary'} w-100`}
                        onClick={() => changeMethod('text')}
                      >
                        <i className="bi bi-keyboard"></i><br/>Text
                      </button>
                    </div>
                    <div className="col-4 text-center">
                      <button 
                        className={`btn ${activeMethod === 'voice' ? 'btn-primary' : 'btn-outline-secondary'} w-100`}
                        onClick={() => changeMethod('voice')}
                      >
                        <i className="bi bi-mic"></i><br/>Voice
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleFormSubmit}>
                    {/* Camera Input Section */}
                    {activeMethod === 'camera' && (
                      <div className="camera-section">
                        <div className="camera-container mb-3">
                          {!showCapturedImage ? (
                            <div className="video-container text-center">
                              <video 
                                ref={videoRef}
                                className="camera-preview" 
                                style={{maxWidth: '100%', maxHeight: '300px', border: '1px solid #ddd'}}
                                autoPlay 
                                playsInline
                                muted
                              />
                              <canvas ref={canvasRef} style={{display: 'none'}} />
                              <div className="text-center mt-3">
                                <button
                                  type="button"
                                  className="btn btn-success"
                                  onClick={capturePhoto}
                                  disabled={!streamRef.current}
                                >
                                  <i className="bi bi-camera"></i> Capture
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="captured-image-container text-center">
                              <img 
                                src={capturedImage} 
                                alt="Captured food" 
                                style={{maxWidth: '100%', maxHeight: '300px', border: '1px solid #ddd'}}
                              />
                              <div className="d-flex justify-content-center mt-3">
                                <button type="button" className="btn btn-secondary mx-2" onClick={retakePhoto}>
                                  <i className="bi bi-arrow-repeat"></i> Retake
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Text Input Section */}
                    {(activeMethod === 'text' || activeMethod === 'voice') && (
                      <div className="text-input-section">
                        <div className="mb-3">
                          <label htmlFor="ingredientsTextarea" className="form-label">Enter ingredients (separated by commas):</label>
                          <textarea 
                            className="form-control" 
                            id="ingredientsTextarea"
                            rows="3"
                            value={voiceText}
                            onChange={handleTextInput}
                            placeholder="Example: eggs, bacon, cheese"
                          ></textarea>
                        </div>
                      </div>
                    )}

                    {/* Cuisine Selection Section */}
                    <div className="cuisine-section mb-4">
                      <h5>Select Cuisine Types (optional):</h5>
                      <div className="row">
                        {cuisineTypes.map(cuisine => (
                          <div className="col-6 col-md-4 mb-2" key={cuisine.id}>
                            <div 
                              className={`cuisine-option p-2 ${selectedCuisines.includes(cuisine.id) ? 'bg-light border' : ''}`}
                              onClick={() => toggleCuisine(cuisine.id)}
                              style={{cursor: 'pointer', borderRadius: '5px'}}
                            >
                              <div className="form-check">
                                <input 
                                  className="form-check-input" 
                                  type="checkbox" 
                                  id={`cuisine-${cuisine.id}`} 
                                  checked={selectedCuisines.includes(cuisine.id)}
                                  onChange={() => {}}
                                />
                                <label className="form-check-label" htmlFor={`cuisine-${cuisine.id}`}>
                                  {cuisine.name}
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="text-center">
                      <button 
                        type="submit" 
                        className="btn btn-primary btn-lg"
                        disabled={(activeMethod === 'camera' && !capturedImage) || 
                                  ((activeMethod === 'text' || activeMethod === 'voice') && !voiceText.trim())}
                      >
                        <i className="bi bi-search"></i> Find Recipes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}