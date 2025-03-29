from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
import jwt
from datetime import datetime, timedelta
from functools import wraps
from bson import ObjectId

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config["MONGO_URI"] = "mongodb://localhost:27017/main_project"  # Update with your DB name
mongo = PyMongo(app)

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
        
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
            
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = mongo.db.users.find_one({'email': data['email']})
            
            if current_user is None:
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
        
    # Check if user already exists
    if mongo.db.users.find_one({'email': data['email']}):
        return jsonify({'message': 'User already exists'}), 409
        
    new_user = {
        'username': data.get('username', ''),
        'email': data['email'],
        'password': data['password'],  # In production, hash the password
        'created_at': datetime.utcnow()
    }
    
    mongo.db.users.insert_one(new_user)
    
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing required fields'}), 400
        
    user = mongo.db.users.find_one({
        'email': data['email'],
        'password': data['password']
    })
    
    if user is None:
        return jsonify({'message': 'Invalid credentials'}), 401
        
    token = jwt.encode({
        'email': user['email'],
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({'token': token}), 200

@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    # Convert MongoDB document to JSON-serializable format
    user_data = {
        'username': current_user.get('username', ''),
        'email': current_user['email'],
        'created_at': current_user['created_at'].isoformat()
    }
    return jsonify(user_data), 200

if __name__ == '__main__':
    print("Flask app is running successfully!")
    app.run(debug=True)