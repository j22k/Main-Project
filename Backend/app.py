# .\venv\Scripts\activate
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
from gemini_analyzer import identify # Keep this for LD analysis
# ***** CHANGE HERE: Import the new dialogue generator *****
from gemini_avatar_dialogue import generate_dialgoue_client_sdk
# *********************************************************
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

# Ensure RL_ACTIONS match the examples/intent in gemini_avatar_dialogue prompt
RL_ACTIONS = [
    "Repeat lesson",
    "Offer additional hint",
    "Slow down pace",
    "Provide encouragement",
    "Proceed normally"
]
rl_agent = EmotionRLAgent(actions=RL_ACTIONS)

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

# --- Routes for Auth, Profile, Assessment Saving, Face Detection (Keep as they are) ---
@app.route('/register', methods=['POST'])
def register():
    # ... (keep existing code) ...
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
    # ... (keep existing code) ...
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
    # ... (keep existing code) ...
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
    # ... (keep existing code, including the call to `identify`) ...
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
            'emotions': emotion_history.copy() # Save snapshot of emotions at assessment time
        }

        # Process handwriting image if provided
        image_filename = None
        if data.get('handwriting') and data['handwriting'].get('imageData'):
            try:
                logger.info("Processing handwriting image")
                image_string = data['handwriting']['imageData']

                if not image_string or not isinstance(image_string, str) or not image_string.startswith('data:image'):
                    logger.warning("Invalid image data format received")
                    raise ValueError("Invalid image data format")

                # Extract base64 data correctly
                header, encoded = image_string.split(",", 1)

                try:
                    image_data = base64.b64decode(encoded)
                except base64.binascii.Error as b64_error:
                    logger.error(f"Invalid base64 image data: {b64_error}")
                    raise ValueError("Invalid base64 image data")

                timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
                # Extract extension from header (e.g., 'image/png')
                img_format = header.split(';')[0].split('/')[1]
                image_filename = f"handwriting_{current_user['email']}_{timestamp}.{img_format}"

                upload_folder = os.path.join(os.getcwd(), 'uploads')
                os.makedirs(upload_folder, exist_ok=True)
                image_path = os.path.join(upload_folder, secure_filename(image_filename))

                with open(image_path, 'wb') as f:
                    f.write(image_data)

                # Store only the filename in the database, not the full path or base64
                data['handwriting']['imageData'] = image_filename
                logger.info(f"Handwriting image saved as {image_filename}")

            except ValueError as ve:
                 # Log the specific value error
                 logger.error(f"Error processing handwriting image data: {ve}")
                 data['handwriting']['imageData'] = None # Ensure it's None if saving failed
            except Exception as e:
                logger.exception(f"Unexpected error processing handwriting image:") # Log full traceback
                data['handwriting']['imageData'] = None # Ensure it's None if saving failed


        # Update assessment_data with other parts from request data
        assessment_data.update({
            'numberComparison': data.get('numberComparison'),
            'handwriting': data.get('handwriting'), # Now contains filename or None
            'letterArrangement': data.get('letterArrangement'),
            'completedAt': data.get('completedAt'), # Assuming frontend sends this
            'emotionTrackingData': data.get('emotionTrackingData', []) # Ensure default if missing
        })


        # Call Gemini analyzer for LD identification
        try:
            logger.info("Calling Gemini analyzer for LD identification")
            # ***** NOTE: `identify` should return JSON as defined in gemini_analyzer.py *****
            gemini_response_json = identify(assessment_data)
            assessment_data['gemini_response'] = gemini_response_json # Store the JSON response
            logger.info("Gemini LD analysis completed successfully")
        except Exception as e:
            logger.error(f"Gemini LD analysis failed: {str(e)}")
            assessment_data['gemini_response'] = {
                'error': 'LD Analysis failed',
                'details': str(e)
            }

        # Save to MongoDB
        try:
            logger.info("Saving assessment to database")
            result = mongo.db.assessments.insert_one(assessment_data)
            logger.info(f"Assessment saved with ID: {result.inserted_id}")
            emotion_history.clear() # Clear history *after* successful save

            return jsonify({
                'message': 'Assessment saved successfully',
                'assessmentId': str(result.inserted_id),
                'ld_analysis': assessment_data.get('gemini_response'), # Return analysis result
                'image_saved': image_filename is not None
            }), 201

        except Exception as e:
            logger.error(f"Database save failed: {str(e)}")
            # Attempt to delete uploaded image if DB save fails? Optional.
            # if image_filename:
            #     try: os.remove(image_path) except OSError: pass
            return jsonify({
                'message': 'Failed to save assessment to database',
                'error': str(e)
            }), 500

    except Exception as e:
        logger.exception(f"Unexpected error in save_assessment:") # Log full traceback
        return jsonify({
            'message': 'An unexpected error occurred during assessment saving',
            'error': str(e)
        }), 500


@app.route('/assessments', methods=['GET'])
@token_required
def get_user_assessments(current_user):
    # ... (keep existing code) ...
    try:
        user_id_str = str(current_user['_id']) # Use the ObjectId string representation
        # Prioritize query by userId if available and reliable
        assessments = list(mongo.db.assessments.find({'userId': user_id_str}).sort("created_at", -1))
        # Fallback or complementary query by email if needed (e.g., for older data)
        if not assessments:
             logger.info(f"No assessments found by userId '{user_id_str}', trying email '{current_user['email']}'")
             assessments = list(mongo.db.assessments.find({'userEmail': current_user['email']}).sort("created_at", -1))

        # Convert ObjectId to string for JSON serialization
        for assessment in assessments:
            assessment['_id'] = str(assessment['_id'])
            # Ensure userId is also a string if it exists
            if 'userId' in assessment and isinstance(assessment['userId'], ObjectId):
                 assessment['userId'] = str(assessment['userId'])


        logger.info(f"Retrieved {len(assessments)} assessments for user {current_user['email']}")
        return jsonify(assessments), 200
    except Exception as e:
        logger.exception(f"Error fetching assessments for user {current_user['email']}:")
        return jsonify({'message': 'Failed to fetch assessments', 'error': str(e)}), 500


@app.route('/facedetection', methods=['POST'])
def face_detection_route():
    # ... (keep existing code) ...
    try:
        if 'image' not in request.files:
            logger.warning("No image file provided in face detection")
            return jsonify({"message": "No image file provided"}), 400

        file = request.files['image']
        # Read image safely
        filestr = file.read()
        if not filestr:
             logger.warning("Empty image file received in face detection")
             return jsonify({"message": "Empty image file received"}), 400

        npimg = np.frombuffer(filestr, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if img is None:
            logger.warning("Could not decode image file.")
            return jsonify({"message": "Invalid image format"}), 400

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w, _ = img.shape

        # Initialize models if they haven't been (consider initializing globally at startup)
        global mp_face_mesh, pth_backbone_model, pth_LSTM_model
        if 'mp_face_mesh' not in globals():
             mp_face_mesh = mp.solutions.face_mesh
        # Add similar checks/initialization for your PyTorch models if needed

        with mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=False, # Set to False if not needed, potentially faster
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5) as face_mesh:

            results = face_mesh.process(img_rgb)

            if results.multi_face_landmarks:
                fl = results.multi_face_landmarks[0] # Process only the first detected face
                startX, startY, endX, endY = get_box(fl, w, h)

                # Ensure box coordinates are valid
                startY, endY = max(0, startY), min(h, endY)
                startX, endX = max(0, startX), min(w, endX)

                if startY >= endY or startX >= endX:
                     logger.warning("Invalid face bounding box calculated.")
                     return jsonify({"message": "Face detected but bounding box invalid"}), 400

                cur_face = img_rgb[startY:endY, startX:endX]

                if cur_face.size == 0:
                     logger.warning("Face crop resulted in an empty image.")
                     return jsonify({"message": "Face detected but crop failed"}), 400

                # Process with PyTorch models
                try:
                    cur_face_pil = Image.fromarray(cur_face)
                    cur_face_processed = pth_processing(cur_face_pil) # Your preprocessing function

                    # Ensure models are loaded (add error handling for model loading)
                    if pth_backbone_model is None or pth_LSTM_model is None:
                         logger.error("Emotion detection models not loaded.")
                         return jsonify({"message": "Emotion models unavailable"}), 500

                    with torch.no_grad(): # Important for inference
                        features = torch.nn.functional.relu(
                            pth_backbone_model.extract_features(cur_face_processed)
                        ).detach().cpu().numpy() # Move to CPU if needed

                        # Ensure features have the expected shape/type
                        if features is None or features.size == 0:
                             logger.warning("Feature extraction yielded empty result.")
                             return jsonify({"message": "Could not extract features"}), 500

                        # Prepare LSTM input (adjust sequence length as needed)
                        lstm_features = [features] * 10 # Assuming sequence length 10
                        lstm_f = torch.from_numpy(np.vstack(lstm_features))
                        lstm_f = torch.unsqueeze(lstm_f, 0) # Add batch dimension

                        output = pth_LSTM_model(lstm_f).detach().cpu().numpy()

                    cl = np.argmax(output)
                    label = DICT_EMO.get(cl, "Unknown") # Use .get for safety
                    confidence = float(output[0][cl])

                    # Add detected emotion to history
                    emotion_history.append(label)
                    # Optional: Limit history size
                    max_history = 50
                    if len(emotion_history) > max_history:
                        emotion_history.pop(0) # Remove oldest entry

                    logger.info(f"Detected emotion: {label} (Confidence: {confidence:.4f})")
                    return jsonify({
                        "emotion": label,
                        "confidence": confidence,
                        "box": [int(startX), int(startY), int(endX), int(endY)]
                    })

                except Exception as model_err:
                    logger.exception("Error during emotion model prediction:")
                    return jsonify({"message": f"Emotion prediction error: {model_err}"}), 500
            else:
                # No face detected, don't add to history
                logger.info("No face detected in image")
                # Return neutral emotion or a specific "no face" indicator?
                # Returning "Neutral" might skew RL if no face is common.
                # Returning a specific message allows frontend to handle it.
                return jsonify({"message": "No face detected"}), 200 # 200 OK, but no detection

    except Exception as e:
        logger.exception("Error in face detection route:")
        return jsonify({"message": f"Server error during face detection: {str(e)}"}), 500

# --- RL Action Endpoint ---
@app.route('/rl_action', methods=['POST'])
def rl_action():
    """
    Determines the next RL action based on recent emotion history
    and generates corresponding avatar dialogue using Gemini.
    """
    try:
        # Optional: Get context from request if frontend sends it
        request_data = request.get_json(silent=True) or {}
        user_context = request_data.get("context", None) # e.g., "Lesson 3: Addition"
        
        logger.info(f"RL Action Triggered. Emotion History Length: {len(emotion_history)}. Context: {user_context}")
        
        # --- State Determination ---
        required_entries = 5 # Number of recent emotions to consider
        if len(emotion_history) < required_entries:
            logger.warning(f"Not enough emotion data for RL action. Need {required_entries}, have {len(emotion_history)}. Using default.")
            current_state = "Neutral" # Default state if not enough data
            # Decide on a default action or just generate neutral dialogue
            action = "Proceed normally" # Or another safe default
            avatar_message = generate_dialogue(action, current_state, user_context)
            return jsonify({
                "state": current_state,
                "action": action, # Default action
                "avatar_message": avatar_message or "Let's keep going!", # Use fallback if generation failed
                "warning": f"Using default state/action due to insufficient emotion data ({len(emotion_history)}/{required_entries})."
            }), 200
        
        # Use the last 'required_entries' emotions
        last_entries = emotion_history[-required_entries:]
        emotion_counter = Counter(last_entries)
        # Determine the most frequent emotion as the current state
        if emotion_counter:
            current_state, _ = emotion_counter.most_common(1)[0]
        else: 
            logger.warning("Emotion counter empty despite history check. Defaulting state to Neutral.")
            current_state = "Neutral"
        
        # --- Action Selection ---
        action = rl_agent.choose_action(current_state) # Your RL agent chooses
        logger.info(f"RL Action determined: State='{current_state}', Action='{action}'")
        
        # --- Generate Dialogue using the new function ---
        # Generate dialogue based on the selected action and emotional state
        action = rl_agent.choose_action(current_state)
        avatar_message = generate_dialgoue_client_sdk(action, current_state, user_context=None)
        # --- Prepare Response ---
        response_data = {
            "state": current_state,
            "action": action,
            "avatar_message": avatar_message, # This is now the generated string
            # Optionally include recent emotions if frontend needs them for viz
            # "recent_emotions": last_entries,
            # "emotion_counts": dict(emotion_counter)
        }
        return jsonify(response_data), 200
    
    except Exception as e:
        logger.exception("Error processing /rl_action request:") # Log full traceback
        # Return a fallback message even on server error
        return jsonify({
            "state": "error",
            "action": "Proceed normally", # Safe fallback action
            "avatar_message": "Oops! Something went wrong on my end. Let's try that again.",
            "error": f"Internal server error: {str(e)}"
        }), 500 # Internal Server Error status
# --- Main Execution ---
if __name__ == '__main__':
    logger.info("Starting Flask application")
    try:
        # Use environment variables for host/port if available, else default
        host = os.getenv('FLASK_RUN_HOST', '0.0.0.0')
        port = int(os.getenv('FLASK_RUN_PORT', 5000))
        debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() in ['true', '1', 't']
        app.run(debug=debug_mode, host=host, port=port)
    except Exception as e:
        logger.critical(f"Failed to start Flask application: {str(e)}", exc_info=True) # Log critical error with traceback
        raise # Re-raise the exception to stop execution if startup fails