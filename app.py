from flask import Flask, request, render_template, jsonify, session, url_for
from tensorflow.keras.models import load_model
from keras.preprocessing.image import load_img, img_to_array
import numpy as np
import os
import uuid
import json
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-key-change-in-production")

# Configuration
UPLOAD_FOLDER = "static/uploads"
MODEL_PATH = "model.h5"
IMAGE_SIZE = 128
MAX_HISTORY_ITEMS = 10
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "tiff"}

# Create necessary directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# Load label map from JSON file
def load_label_map():
    """Load class labels from JSON file."""
    try:
        with open("label_map.json", "r") as f:
            class_labels = json.load(f)
        print(f"Label map loaded successfully: {class_labels}")
        return class_labels
    except Exception as e:
        print(f"Error loading label map: {e}")
        # Fallback to default labels if JSON loading fails
        return ["glioma", "meningioma", "notumor", "pituitary"]


CLASS_LABELS = load_label_map()

# Global model variable
model = None


def load_prediction_model():
    """Load the trained model with error handling."""
    global model
    if model is None:
        try:
            model = load_model(MODEL_PATH)
            print(f"Model loaded successfully from {MODEL_PATH}")
        except Exception as e:
            print(f"Error loading model: {e}")
            raise RuntimeError(f"Failed to load model from {MODEL_PATH}: {e}")
    return model


def allowed_file(filename):
    """Check if the uploaded file has an allowed extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_session_history():
    """Get or initialize session history."""
    if "history" not in session:
        session["history"] = []
    return session["history"]


def add_to_history(history_item):
    """Add item to history and maintain max items limit."""
    history = get_session_history()
    history.insert(0, history_item)
    session["history"] = history[:MAX_HISTORY_ITEMS]
    session.modified = True


def detect_and_predict(img_path, model, image_size=128):
    """Detect tumor using the provided detection function structure."""
    try:
        img = load_img(img_path, target_size=(image_size, image_size))
        img_array = img_to_array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        predictions = model.predict(img_array)
        predicted_class_index = np.argmax(predictions, axis=1)[0]
        confidence_score = np.max(predictions, axis=1)[0]
        predicted_label = CLASS_LABELS[predicted_class_index]

        result = (
            "No Tumor" if predicted_label == "notumor" else f"Tumor: {predicted_label}"
        )

        return {
            "success": True,
            "result": result,
            "predicted_label": predicted_label,
            "confidence": float(confidence_score * 100),
        }

    except Exception as e:
        return {"success": False, "error": f"Error processing the image: {str(e)}"}


def predict_tumor(img_path):
    """Detect tumor and return prediction results using JSON label map."""
    try:
        # Load and preprocess the image
        img = load_img(img_path, target_size=(IMAGE_SIZE, IMAGE_SIZE))
        img_array = img_to_array(img) / 255.0  # Normalize pixel values
        img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension

        # Get model and make prediction
        prediction_model = load_prediction_model()
        predictions = prediction_model.predict(img_array)
        predicted_class_index = np.argmax(predictions, axis=1)[0]
        confidence_score = np.max(predictions, axis=1)[0]
        predicted_label = CLASS_LABELS[predicted_class_index]

        # Get all class probabilities
        class_probabilities = {
            label: float(predictions[0][i] * 100)
            for i, label in enumerate(CLASS_LABELS)
        }

        # Determine the result using the new logic
        if predicted_label == "notumor":
            result = "No Tumor"
            result_type = "healthy"
        else:
            result = f"Tumor: {predicted_label}"
            result_type = "tumor"

        return {
            "success": True,
            "result": result,
            "result_type": result_type,
            "predicted_class": predicted_label,
            "confidence": float(confidence_score * 100),
            "class_probabilities": class_probabilities,
        }

    except Exception as e:
        return {"success": False, "error": f"Prediction failed: {str(e)}"}


@app.route("/")
def index():
    """Render the main page with history."""
    return render_template("index.html", history=get_session_history())


@app.route("/upload", methods=["POST"])
def upload_file():
    """Handle file upload and prediction."""
    # Validate request
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file selected"})

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "No file selected"})

    if not (file and allowed_file(file.filename)):
        return jsonify(
            {
                "success": False,
                "error": "Invalid file type. Please upload a valid image file.",
            }
        )

    try:
        # Generate unique filename
        file_extension = file.filename.rsplit(".", 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)

        # Save file
        file.save(filepath)

        # Make prediction
        prediction = predict_tumor(filepath)

        if prediction["success"]:
            # Add to history
            history_item = {
                "filename": file.filename,
                "filepath": unique_filename,
                "timestamp": datetime.now().strftime("%a %d %b, %I:%M %p"),
                "result": prediction["result"],
                "result_type": prediction["result_type"],
                "confidence": prediction["confidence"],
            }
            add_to_history(history_item)

            # Return prediction with file path
            prediction["filepath"] = url_for(
                "static", filename=f"uploads/{unique_filename}"
            )
            return jsonify(prediction)
        else:
            # Remove file if prediction failed
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify(prediction)

    except Exception as e:
        # Clean up file if something went wrong
        if "filepath" in locals() and os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"success": False, "error": f"Upload failed: {str(e)}"})


@app.route("/reset", methods=["POST"])
def reset():
    """Reset the current session state."""
    return jsonify({"success": True})


@app.route("/clear_history", methods=["POST"])
def clear_history():
    """Clear the session history."""
    session["history"] = []
    session.modified = True
    return jsonify({"success": True})


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return render_template("index.html", history=get_session_history()), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({"success": False, "error": "Internal server error"}), 500


if __name__ == "__main__":
    # Load model at startup to catch errors early
    try:
        load_prediction_model()
        port = int(os.environ.get("PORT", 5555))  # 5555 for local dev
        app.run(debug=True, host="0.0.0.0", port=port)
    except RuntimeError as e:
        print(f"Failed to start application: {e}")
        exit(1)
