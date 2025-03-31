import os
import re
import base64
import datetime
import logging
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
from RL import EmotionRLAgent
from collections import Counter


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
try:
    mongo.db.users.create_index("email", unique=True)
    mongo.db.assessments.create_index([("userId", 1), ("created_at", -1)])
    logger.info("Database indexes created successfully")
except Exception as e:
    logger.error(f"Error creating database indexes: {str(e)}")

emotion_history = []

# Check MongoDB connection
def check_mongo_connection():
    try:
        mongo.db.command("ping")
        logger.info("Connected to MongoDB successfully!")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {str(e)}")

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
            logger.warning("Token is missing in request")
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = mongo.db.users.find_one({'email': data['email']})
            if not current_user:
                logger.warning(f"User not found for email: {data['email']}")
                return jsonify({'message': 'User not found!'}), 401
        except jwt.ExpiredSignatureError:
            logger.warning("Expired token received")
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            logger.warning("Invalid token received")
            return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return jsonify({'message': 'Token validation failed!'}), 401

        return f(current_user, *args, **kwargs)
    
    return decorated

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        logger.warning("Missing required fields in registration")
        return jsonify({'message': 'Missing required fields'}), 400

    if mongo.db.users.find_one({'email': data['email']}):
        logger.warning(f"User already exists: {data['email']}")
        return jsonify({'message': 'User already exists'}), 409

    new_user = {
        'username': data.get('username', ''),
        'email': data['email'],
        'password': generate_password_hash(data['password']),
        'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    
    try:
        mongo.db.users.insert_one(new_user)
        logger.info(f"New user registered: {data['email']}")
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        logger.error(f"Registration failed for {data['email']}: {str(e)}")
        return jsonify({'message': 'Registration failed'}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        logger.warning("Missing credentials in login attempt")
        return jsonify({'message': 'Missing required fields'}), 400

    user = mongo.db.users.find_one({'email': data['email']})
    if not user or not check_password_hash(user['password'], data['password']):
        logger.warning(f"Invalid login attempt for {data['email']}")
        return jsonify({'message': 'Invalid credentials'}), 401

    token = jwt.encode({
        'email': user['email'],
        'exp': datetime.datetime.now(datetime.timezone.utc) + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    logger.info(f"User logged in: {data['email']}")
    return jsonify({'token': token}), 200

@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    user_data = {
        'username': current_user.get('username', ''),
        'email': current_user['email'],
        'created_at': current_user['created_at']
    }
    logger.info(f"Profile accessed for {current_user['email']}")
    return jsonify(user_data), 200

@app.route('/save-assessment', methods=['POST'])
@token_required
def save_assessment(current_user):
    logger.info(f"Received assessment save request from {current_user['email']}")
    
    if not request.is_json:
        logger.error("Request is not JSON")
        return jsonify({'message': 'Request must be JSON'}), 400
        
    data = request.get_json()
    if not data:
        logger.error("No data provided in request")
        return jsonify({'message': 'No data provided'}), 400

    try:
        assessment_data = {
            'userId': str(current_user['_id']),
            'userEmail': current_user['email'],
            'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'emotions': emotion_history.copy()
        }

        # Process handwriting image if provided
        image_filename = None
        if data.get('handwriting') and 'imageData' in data['handwriting']:
            try:
                logger.info("Processing handwriting image")
                image_string = data['handwriting']['imageData']
                
                if not image_string or not isinstance(image_string, str):
                    logger.warning("Invalid image data format")
                    raise ValueError("Invalid image data format")
                
                image_string = re.sub(r"^data:image\/\w+;base64,", "", image_string)
                
                try:
                    image_data = base64.b64decode(image_string)
                except base64.binascii.Error:
                    logger.error("Invalid base64 image data")
                    raise ValueError("Invalid base64 image data")
                
                timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
                image_filename = f"handwriting_{timestamp}.png"
                upload_folder = os.path.join(os.getcwd(), 'uploads')
                os.makedirs(upload_folder, exist_ok=True)
                image_path = os.path.join(upload_folder, secure_filename(image_filename))
                
                with open(image_path, 'wb') as f:
                    f.write(image_data)
                
                data['handwriting']['imageData'] = image_filename
                logger.info(f"Handwriting image saved as {image_filename}")
                
            except Exception as e:
                logger.error(f"Error processing handwriting image: {str(e)}")
                data['handwriting']['imageData'] = None

        assessment_data.update({
            'numberComparison': data.get('numberComparison'),
            'handwriting': data.get('handwriting'),
            'letterArrangement': data.get('letterArrangement'),
            'completedAt': data.get('completedAt'),
            'emotionTrackingData': data.get('emotionTrackingData', [])
        })

        # Call Gemini analyzer
        try:
            logger.info("Calling Gemini analyzer")
            gemini_response = identify(assessment_data)
            assessment_data['gemini_response'] = gemini_response
            logger.info("Gemini analysis completed successfully")
        except Exception as e:
            logger.error(f"Gemini analysis failed: {str(e)}")
            assessment_data['gemini_response'] = {
                'error': 'Analysis failed',
                'details': str(e)
            }

        # Save to MongoDB
        try:
            logger.info("Saving assessment to database")
            result = mongo.db.assessments.insert_one(assessment_data)
            logger.info(f"Assessment saved with ID: {result.inserted_id}")
            emotion_history.clear()
            
            return jsonify({
                'message': 'Assessment saved successfully',
                'assessmentId': str(result.inserted_id),
                'image_saved': image_filename is not None
            }), 201
            
        except Exception as e:
            logger.error(f"Database save failed: {str(e)}")
            return jsonify({
                'message': 'Failed to save assessment to database',
                'error': str(e)
            }), 500

    except Exception as e:
        logger.error(f"Unexpected error in save_assessment: {str(e)}")
        return jsonify({
            'message': 'An unexpected error occurred',
            'error': str(e)
        }), 500

@app.route('/assessments', methods=['GET'])
@token_required
def get_user_assessments(current_user):
    try:
        user_id = str(current_user['_id'])
        assessments = list(mongo.db.assessments.find({'userId': user_id}))
        if not assessments:
            assessments = list(mongo.db.assessments.find({'userEmail': current_user['email']}))
        for assessment in assessments:
            assessment['_id'] = str(assessment['_id'])
        logger.info(f"Retrieved {len(assessments)} assessments for {current_user['email']}")
        return jsonify(assessments), 200
    except Exception as e:
        logger.error(f"Error fetching assessments: {str(e)}")
        return jsonify({'message': 'Failed to fetch assessments'}), 500

@app.route('/facedetection', methods=['POST'])
def face_detection_route(): 
    try:
        if 'image' not in request.files:
            logger.warning("No image file provided in face detection")
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
                    logger.info(f"Detected emotion: {label}")
                    return jsonify({
                        "emotion": label,
                        "confidence": float(output[0][cl]),
                        "box": [int(startX), int(startY), int(endX), int(endY)]
                    })
            else:
                logger.warning("No face detected in image")
                return jsonify({"message": "No face detected"}), 400
    except Exception as e:
        logger.error(f"Face detection error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500
    
@app.route('/rl_action', methods=['GET', 'POST'])
def rl_action():
    try:
        data = request.get_json()
        print("Received Data:", data)
        print("Emotion History:", emotion_history)
        print("Emotion History Length:", len(emotion_history))
        if len(emotion_history) < 10:
            return jsonify({
                "error": "Not enough emotion data. At least 10 emotion entries required.",
                "currentCount": len(emotion_history)
            }), 400
        
        last_ten = emotion_history[-10:]
        emotion_counter = Counter(last_ten)
        current_state, count = emotion_counter.most_common(1)[0]

        action = EmotionRLAgent.choose_action(current_state)
        print(f"🧠 Current State: {current_state}, Action: {action}")

        return jsonify({
            "state": current_state,
            "action": action,
            "last_ten_emotions": last_ten,
            "emotion_counts": dict(emotion_counter)
        })
    except Exception as e:
        print("Error processing /rl_action:", str(e))
        return jsonify({"error": str(e)}), 500

    
if __name__ == '__main__':
    logger.info("Starting Flask application")
    try:
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        logger.error(f"Failed to start Flask application: {str(e)}")
        raise