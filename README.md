# 🧠 Brain Tumor Detection Web App

A Flask-based web application that uses a trained deep learning model to detect brain tumors from MRI images.

## 📁 Folder Structure

```

project-root/  
│  
├── static/  
├── templates/
├── model.h5 # Trained Keras model (downloaded separately)  
├── app.py # Main Flask app  
├── requirements.txt
└──

````

## 🔗 Download the Model

📥 [Download the trained model file (`model.h5`)](https://your-download-link.com/model.h5)  
Place it in the root directory of the project (same level as `app.py`).

## 📦 Install Dependencies

Create a virtual environment (recommended):

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
````

Then install dependencies:

```bash
pip install -r requirements.txt
```

---

## 🚀 Run the App

```bash
python app.py
```

Then open your browser and visit:

```
http://127.0.0.1:5555
```


## 🧪 Features

- Upload an MRI image.
    
- Predict tumor type: `glioma`, `meningioma`, `pituitary`, or `no tumor`.
    
- Displays confidence score.
    
- Shows uploaded image with result overlay.
    

## 📸 Screenshots

### 🖼️ Upload Page

![Upload Page](screenshots/upload.png)

### 🧠 Prediction Result

![Prediction Output](screenshots/result.png)

### 📊 Confidence Display

![Confidence](screenshots/confidence.png)

> You can replace the screenshot paths with your own images in the `screenshots/` folder.


## 📄 License

This project is licensed under the MIT License.  
Feel free to fork, modify, and use it for your own purposes.
