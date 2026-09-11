# 🎵 Moodsongs — Emotion-Based Indian Music

Recommends songs in **Hindi, Tamil, Telugu, Punjabi, Bengali** based on your mood.
Pick manually or let your **camera detect your facial expression** — all local, no API key needed.

---

## Quick Start (3 steps)

### 1. Install
```bash
pip install flask pandas fer opencv-python mtcnn
```

### 2. Run
```bash
python app.py
```

### 3. Open
```
http://127.0.0.1:5000
```

---

## Features

| Feature | Details |
|---|---|
| 🎭 **7 emotions** | Happy, Romantic, Sad, Energetic, Calm, Angry, Relaxed |
| 🌏 **6 languages** | Hindi, Tamil, Telugu, Punjabi, Bengali, Kannada |
| 🎵 **400+ songs** | Classics to current hits |
| 📷 **Face detection** | face-api.js |
| ▶️ **30-sec previews** | iTunes Search API (free, no key) |
| 🎛️ **Custom count** | Choose 5 to 50 songs |
| 🌐 **Language filter** | Filter by language in the UI |

---

## How song previews work

When you click ▶️ on a song card, the app queries the **iTunes Search API** (completely free, no login):
```
https://itunes.apple.com/search?term=<song+artist>&media=music
```
If a 30-second preview exists, it plays directly in the page via an audio player at the bottom. If not, the button dims. No account needed.

---





## Project files
## 🛠 Tech Stack

### Backend
- Python
- Flask
- Pandas
- NumPy

### Frontend
- HTML5
- CSS3
- JavaScript (ES2022)

### AI / ML
- face-api.js
- TinyFaceDetector
- FaceExpressionNet
- WebGL

### Dataset
- 400+ Songs
- 6 Languages
- 7 Emotions
- CSV + Pandas

### External API
- iTunes Search API (Song Previews)

### Architecture
- Single Page Application (SPA)
- REST API (Flask)
- Client-side Emotion Detection
- Content-based Recommendation System

```
moodsongs/
├── app.py                  Flask server
├── dataset.csv             400+ songs (6 languages, 7 emotions)
├── emotion_detector.py     Local face emotion detector
├── templates/index.html    Website UI
├── static/style.css        Styling
├── static/script.js        Frontend logic + music player
└── requirements.txt        Dependencies
```

---

## Troubleshooting

**Port in use:**
```bash
python app.py  # then change port in app.py if needed
```

**Camera not working:** Allow camera in browser popup. Works on localhost / HTTPS only.

**No song preview:** Not all songs have iTunes previews. Try another song or check your internet.

**All detections show "calm":** Install FER — `pip install fer mtcnn`. OpenCV fallback has limited accuracy.
