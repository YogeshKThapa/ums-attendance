from pymongo import MongoClient
import os

# Connection string from app.py
MONGO_URI = "mongodb+srv://kumaryog2005:p6Vdbr2S3zFSUWWc@cluster0.wtlqmjg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

try:
    print(f"Connecting to: {MONGO_URI.split('@')[1]}") # Hide credentials
    client = MongoClient(MONGO_URI)
    
    # Force a connection verification
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
    
    db = client.ums_db
    print(f"Database: {db.name}")
    
    # Try to insert and delete a test document
    result = db.test_collection.insert_one({"test": "value"})
    print(f"Inserted document with ID: {result.inserted_id}")
    
    db.test_collection.delete_one({"_id": result.inserted_id})
    print("Deleted test document.")
    
except Exception as e:
    print(f"Connection failed: {e}")
