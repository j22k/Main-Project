import os
import re
import base64
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
import jwt
from datetime import timedelta
from functools import wraps
from bson import ObjectId
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import cv2
import numpy as np
import torch
import mediapipe as mp
from PIL import Image

from gemini_analyzer import identify
from EmotionDetection.model import pth_backbone_model, pth_LSTM_model
from EmotionDetection.utlis import pth_processing, get_box

load_dotenv()

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key')
app.config["MONGO_URI"] = os.getenv("MONGO_URI", "mongodb://localhost:27017/main_project")
mongo = PyMongo(app)


# Initialize Face Mesh and Emotion Dictionary
mp_face_mesh = mp.solutions.face_mesh
DICT_EMO = {0: 'Neutral', 1: 'Happiness', 2: 'Sadness', 3: 'Surprise', 4: 'Fear', 5: 'Disgust', 6: 'Anger'}

# Create indexes for users and assessments
mongo.db.users.create_index("email", unique=True)
mongo.db.assessments.create_index([("userId", 1), ("created_at", -1)])

emotion_history = [] 

# Check MongoDB connection
def check_mongo_connection():
    try:
        mongo.db.command("ping")
        print("Connected to MongoDB successfully!")
    except Exception as e:
        print("Failed to connect to MongoDB:", e)

check_mongo_connection()

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header:
            parts = auth_header.split(" ")
            if len(parts) == 2:
                token = parts[1]
                
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = mongo.db.users.find_one({'email': data['email']})
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except Exception as e:
            print(e)
            return jsonify({'message': 'Token is invalid!'}), 401

        return f(current_user, *args, **kwargs)
    
    return decorated

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing required fields'}), 400

    if mongo.db.users.find_one({'email': data['email']}):
        return jsonify({'message': 'User already exists'}), 409

    new_user = {
        'username': data.get('username', ''),
        'email': data['email'],
        'password': generate_password_hash(data['password']),
        # Using a timezone-aware datetime converted to ISO string
        'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    
    mongo.db.users.insert_one(new_user)
    
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing required fields'}), 400

    user = mongo.db.users.find_one({'email': data['email']})
    if not user or not check_password_hash(user['password'], data['password']):
        return jsonify({'message': 'Invalid credentials'}), 401

    token = jwt.encode({
        'email': user['email'],
        'exp': datetime.datetime.now(datetime.timezone.utc) + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({'token': token}), 200

@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    user_data = {
        'username': current_user.get('username', ''),
        'email': current_user['email'],
        'created_at': current_user['created_at']
    }
    return jsonify(user_data), 200

@app.route('/save-assessment', methods=['POST'])
@token_required
def save_assessment(current_user):
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No data provided'}), 400

    image_filename = None
    # Process handwriting image if provided
    if data.get('handwriting') and 'imageData' in data['handwriting']:
        try:
            image_string = data['handwriting']['imageData']
            # Remove any data header from the base64 string
            image_string = re.sub(r"^data:image\/\w+;base64,", "", image_string)
            image_data = base64.b64decode(image_string)
            timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
            image_filename = f"handwriting_{timestamp}.png"
            upload_folder = os.path.join(os.getcwd(), 'uploads')
            os.makedirs(upload_folder, exist_ok=True)
            image_path = os.path.join(upload_folder, secure_filename(image_filename))
            with open(image_path, 'wb') as f:
                f.write(image_data)
            # Replace the base64 data with the filename reference
            data['handwriting']['imageData'] = image_filename
        except Exception as e:
            print(f"Error handling image: {str(e)}")
    
    assessment_data = {
        'userId': str(current_user['_id']),
        'userEmail': current_user['email'],
        'numberComparison': data.get('numberComparison'),
        'handwriting': data.get('handwriting'),
        'letterArrangement': data.get('letterArrangement'),
        'completedAt': data.get('completedAt'),
        # Store created_at as an ISO-formatted, timezone-aware datetime string
        'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
         'emotions': data.get('emotions', []),
    }
    
    try:
        # Call the Gemini analyzer and capture its JSON output
        gemini_response = identify(assessment_data)
    except Exception as e:
        return jsonify({'message': f'Error processing assessment: {str(e)}'}), 500

    # Save both assessment data and Gemini response to the database
    assessment_data['gemini_response'] = gemini_response
    
    mongo.db.assessments.insert_one(assessment_data)
    
    return jsonify({
        'message': 'Assessment saved successfully',
        'image_saved': image_filename is not None
    }), 201

@app.route('/assessments', methods=['GET'])
@token_required
def get_user_assessments(current_user):
    try:
        user_id = str(current_user['_id'])
        assessments = list(mongo.db.assessments.find({'userId': user_id}))
        # Fallback: search by email if necessary
        if not assessments:
            assessments = list(mongo.db.assessments.find({'userEmail': current_user['email']}))
        for assessment in assessments:
            assessment['_id'] = str(assessment['_id'])
        return jsonify(assessments), 200
    except Exception as e:
        print(f"Error fetching assessments: {str(e)}")
        return jsonify({'message': 'Failed to fetch assessments'}), 500



@app.route('/facedetection', methods=['POST'])
def face_detection_route(): 
    try:
        if 'image' not in request.files:
            return jsonify({"message": "No image file provided"}), 400

        file = request.files['image']
        npimg = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w, _ = img.shape

        with mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5) as face_mesh:

            results = face_mesh.process(img_rgb)
            if results.multi_face_landmarks:
                for fl in results.multi_face_landmarks:
                    startX, startY, endX, endY = get_box(fl, w, h)
                    cur_face = img_rgb[startY:endY, startX:endX]
                    cur_face = pth_processing(Image.fromarray(cur_face))

                    features = torch.nn.functional.relu(
                        pth_backbone_model.extract_features(cur_face)
                    ).detach().numpy()

                    lstm_features = [features] * 10
                    lstm_f = torch.from_numpy(np.vstack(lstm_features))
                    lstm_f = torch.unsqueeze(lstm_f, 0)

                    output = pth_LSTM_model(lstm_f).detach().numpy()
                    cl = np.argmax(output)
                    label = DICT_EMO[cl]

                    emotion_history.append(label)
                    return jsonify({
                        "emotion": label,
                        "confidence": float(output[0][cl]),
                        "box": [int(startX), int(startY), int(endX), int(endY)]
                    })
            else:
                return jsonify({"message": "No face detected"}), 400
    except Exception as e:
        return jsonify({"message": f"Server error: {str(e)}"}), 500

if __name__ == '__main__':
    print("Flask app is running successfully!")
    app.run(debug=True)
