import React, { useState, useRef, useCallback } from "react";
import "./App.css";

// --- CAESAR CIPHER FUNCTIONS ---

/**
 * Calculates the Caesar shift value from a PIN string.
 * It sums the ASCII codes of the characters in the PIN and
 * returns the result modulo 26 (for A-Z) or 256 (for all ASCII).
 * We'll use 256 since the text-to-PNG encoding uses the full ASCII range.
 * @param {string} pin The PIN string.
 * @returns {number} The shift value (0-255).
 */
const getShiftFromPin = (pin) => {
  if (!pin) return 0;
  let shift = 0;
  for (let i = 0; i < pin.length; i++) {
    shift = (shift + pin.charCodeAt(i)) % 256;
  }
  return shift;
};

/**
 * Encrypts/Decrypts text using the Caesar Cipher on all ASCII characters.
 * @param {string} text The text to process.
 * @param {number} shift The shift value.
 * @param {boolean} isEncrypt True for encryption, False for decryption.
 * @returns {string} The processed text.
 */
const caesarCipher = (text, shift, isEncrypt) => {
  if (!text || shift === 0) return text;

  const finalShift = isEncrypt ? shift : (256 - shift) % 256;
  let result = "";

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Ensure the shift is applied within the 256 ASCII range (0-255)
    const newCharCode = (charCode + finalShift) % 256;
    result += String.fromCharCode(newCharCode);
  }
  return result;
};

// --- REACT COMPONENT ---

function App() {
  // --- State ---
  const [textInput, setTextInput] = useState("");
  const [textFileInput, setTextFileInput] = useState(null);
  const [isTextFileMode, setIsTextFileMode] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [decodedText, setDecodedText] = useState("");
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const textFileRef = useRef(null);

  // Helper to read the content of the uploaded text file
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(new Error("Could not read text file."));
      reader.readAsText(file);
    });
  };

  // --- ENCODING: Text -> Caesar Cipher -> PNG ---
  const handleEncode = async () => {
    let contentToEncode = "";

    if (isTextFileMode) {
      if (!textFileInput) {
        setMessage("Please select a text file to encode.");
        return;
      }
      try {
        contentToEncode = await readFileContent(textFileInput);
      } catch (error) {
        setMessage(`Error reading file: ${error.message}`);
        return;
      }
    } else {
      contentToEncode = textInput.trim();
      if (!contentToEncode) {
        setMessage("Please enter text to encode.");
        return;
      }
    }

    // --- PIN and Encryption Step (NEW) ---
    const pin = prompt("Enter PIN for encryption:");
    if (!pin) {
      setMessage("Encryption cancelled: PIN is required.");
      return;
    }
    const shift = getShiftFromPin(pin);
    const encryptedContent = caesarCipher(contentToEncode, shift, true);
    // -------------------------------------

    setIsProcessing(true);
    setMessage("Encrypting and encoding text to PNG...");
    setDecodedText("");
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);

    try {
      // 1. Calculate image dimensions (uses encryptedContent length)
      const totalChars = encryptedContent.length;
      const width = Math.ceil(Math.sqrt(totalChars));
      const height = Math.ceil(totalChars / width);

      // 2. Create canvas and context
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      // 3. Get image data and loop through encrypted text
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      let dataIndex = 0;
      for (let i = 0; i < encryptedContent.length; i++) {
        const ascii = encryptedContent.charCodeAt(i);

        // Store the ASCII code in the Red channel (0-255)
        data[dataIndex] = ascii;
        // Set Alpha to 255 (fully opaque)
        data[dataIndex + 3] = 255;

        dataIndex += 4; // Move to the next pixel
      }

      // 4. Put the pixel data onto the canvas
      ctx.putImageData(imageData, 0, 0);

      // 5. Get a Blob URL from the canvas
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        setMessage("Encrypted PNG generated successfully! Remember your PIN.");
        setIsProcessing(false);
      }, "image/png");
    } catch (error) {
      console.error("Encoding Error:", error);
      setMessage(`Error encoding: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // --- DECODING: PNG -> Caesar Cipher -> Text ---
  const handleDecode = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // --- PIN and Decryption Setup Step (NEW) ---
    const pin = prompt("Enter PIN to decrypt the text:");
    if (!pin) {
      setMessage("Decryption cancelled: PIN is required.");
      if (fileInputRef.current) fileInputRef.current.value = null;
      return;
    }
    const shift = getShiftFromPin(pin);
    // -------------------------------------

    setIsProcessing(true);
    setMessage("Decoding image to text...");
    setTextInput("");
    setTextFileInput(null);
    setDecodedText("");
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);

    try {
      // 1. Convert PNG to Encrypted Text
      const encryptedText = await imageToText(file);

      // 2. Decrypt the Text (NEW)
      const decryptedText = caesarCipher(encryptedText, shift, false);

      setDecodedText(decryptedText);
      setMessage("Image decoded and decrypted successfully!");
    } catch (error) {
      console.error("Decoding Error:", error);
      setMessage(`Error decoding/decrypting: ${error.message}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }
    }
  };

  // Helper function to process the image file (Unchanged)
  const imageToText = (imageFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");

          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          let text = "";

          for (let i = 0; i < data.length; i += 4) {
            const ascii = data[i];

            if (ascii === 0) {
              break;
            }

            text += String.fromCharCode(ascii);
          }
          resolve(text);
        };
        img.onerror = (err) => reject(new Error("Could not load image."));
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(new Error("Could not read file."));
      reader.readAsDataURL(imageFile);
    });
  };

  // --- Download Decoded Text (Unchanged) ---
  const handleDownloadText = () => {
    if (!decodedText) return;

    const blob = new Blob([decodedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "decrypted_text.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handler for file input change (Unchanged)
  const handleTextFileChange = (e) => {
    const file = e.target.files[0] || null;
    setTextFileInput(file);
    if (file) {
      setTextInput("");
    }
  };

  // Handler to toggle mode (Unchanged)
  const toggleInputMode = useCallback(() => {
    setIsTextFileMode((prev) => !prev);
    if (isTextFileMode) {
      setTextFileInput(null);
      if (textFileRef.current) textFileRef.current.value = null;
    } else {
      setTextInput("");
    }
  }, [isTextFileMode]);

  // --- JSX ---
  return (
    <div className="App">
      <header className="App-header">
        <h1>Matrix Inversion and AES 256 Golden 🔒</h1>
        <p style={{ color: "yellow" }}>
          **NOTE: PIN prompts will appear before Encode/Decode actions.**
        </p>
        {message && <p className="message">{message}</p>}

        {/* --- ENCODER SECTION --- */}
        <div className="section">
          <h2>Encode & Encrypt Text to PNG</h2>

          <button onClick={toggleInputMode} disabled={isProcessing}>
            Switch to {isTextFileMode ? "Textarea Input" : "File Upload (.txt)"}
          </button>
          <br />
          <br />

          {isTextFileMode ? (
            // FILE UPLOAD MODE
            <div className="file-upload-mode">
              <input
                type="file"
                accept=".txt"
                onChange={handleTextFileChange}
                disabled={isProcessing}
                ref={textFileRef}
              />
              {textFileInput && (
                <p>
                  File selected: <strong>{textFileInput.name}</strong>
                </p>
              )}
            </div>
          ) : (
            // TEXTAREA MODE
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text here to encode..."
              rows="5"
              cols="40"
              disabled={isProcessing}
            />
          )}

          <br />
          <button
            onClick={handleEncode}
            disabled={isProcessing || (!textInput.trim() && !textFileInput)}
          >
            {isProcessing ? "Processing..." : "Encrypt & Generate PNG"}
          </button>

          {imageUrl && (
            <div className="result-area">
              <h3>Generated Image (Encrypted):</h3>
              <img
                src={imageUrl}
                alt="Encoded text"
                style={{ border: "1px solid white", maxWidth: "100%" }}
              />
              <br />
              <a href={imageUrl} download="encrypted_text.png">
                Download PNG
              </a>
            </div>
          )}
        </div>

        <hr style={{ width: "80%" }} />

        {/* --- DECODER SECTION --- */}
        <div className="section">
          <h2>Decode & Decrypt PNG to Text</h2>
          <input
            type="file"
            accept="image/png"
            onChange={handleDecode}
            disabled={isProcessing}
            ref={fileInputRef}
          />

          {decodedText && (
            <div className="result-area">
              <h3>Decrypted Text:</h3>
              <pre className="decoded-text">{decodedText}</pre>
              <button
                onClick={handleDownloadText}
                disabled={isProcessing || !decodedText}
              >
                Download Decrypted Text (.txt)
              </button>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
