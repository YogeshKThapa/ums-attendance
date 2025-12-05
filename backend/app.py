import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
import base64
import uuid
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Store active sessions in memory
sessions = {}

BASE_URL = "https://online.uktech.ac.in"
# New URL for public view
LOGIN_URL = f"{BASE_URL}/ums/Student/Public/ViewDetail"

@app.route('/', methods=['GET'])
def health_check():
    return "UMS Backend Running", 200

@app.route('/api/init', methods=['GET'])
def init_session():
    """
    Initializes a session, fetches the page, and gets the CAPTCHA.
    """
    session_id = str(uuid.uuid4())
    session = requests.Session()
    sessions[session_id] = session

    try:
        # 1. Get Page
        resp = session.get(LOGIN_URL)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        # 2. Find CAPTCHA Image URL
        # Based on inspection: <img src="/ums/Student/Master/GetCaptchaimage" ...>
        captcha_img_tag = soup.find('img', src=lambda x: x and 'GetCaptchaimage' in x)
        if not captcha_img_tag:
             captcha_img_tag = soup.find('img', id='imgCaptcha')

        if not captcha_img_tag:
             return jsonify({"error": "Could not find CAPTCHA image"}), 500
        
        captcha_url = BASE_URL + captcha_img_tag.get('src')
        
        # 3. Fetch CAPTCHA Image
        captcha_resp = session.get(captcha_url)
        captcha_resp.raise_for_status()
        captcha_b64 = base64.b64encode(captcha_resp.content).decode('utf-8')

        return jsonify({
            "session_id": session_id,
            "captcha_image": f"data:image/png;base64,{captcha_b64}"
        })

    except Exception as e:
        logger.error(f"Init error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    session_id = data.get('session_id')
    roll_no = data.get('login_id') # Reuse login_id field for RollNo
    dob = data.get('password')     # Reuse password field for DOB
    captcha_text = data.get('captcha_text')

    if not session_id or session_id not in sessions:
        return jsonify({"error": "Invalid or expired session"}), 400

    session = sessions[session_id]

    # No encryption needed for this public form based on inspection
    payload = {
        "RollNo": roll_no,
        "DateOfBirth": dob,
        "Captcha": captcha_text
    }

    try:
        # Add headers to mimic a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': LOGIN_URL,
            'Origin': BASE_URL
        }
        
        # Perform Submit
        logger.info(f"Attempting fetch for session {session_id} with RollNo {roll_no}")
        post_resp = session.post(LOGIN_URL, data=payload, headers=headers)
        
        logger.info(f"Response Code: {post_resp.status_code}")
        
        # Check for specific error messages
        if "Invalid Captcha" in post_resp.text:
             logger.warning("Result: Invalid Captcha")
             return jsonify({"success": False, "message": "Invalid CAPTCHA"}), 401
        
        # Heuristic for success: If we see the RollNo in the table, it worked.
        if roll_no in post_resp.text:
             logger.info("Result: Success")
             
             # Parse the response to get details and hidden fields
             soup = BeautifulSoup(post_resp.text, 'html.parser')
             
             student_data = {
                 "student_name": soup.find('label', id='lblStudentName').text.strip() if soup.find('label', id='lblStudentName') else "Unknown",
                 "father_name": soup.find('label', id='lblFatherName').text.strip() if soup.find('label', id='lblFatherName') else "Unknown",
                 "course_name": soup.find('label', id='CourseName').text.strip() if soup.find('label', id='CourseName') else "Unknown",
                 "branch_name": soup.find('label', id='BranchName').text.strip() if soup.find('label', id='BranchName') else "Unknown",
             }
             
             hidden_fields = {}
             for hid in ['hdnCollegeId', 'hdnBranchId', 'hdnCourseId', 'hdnStudentAdmissionId']:
                 tag = soup.find('input', id=hid)
                 if tag:
                     hidden_fields[hid] = tag.get('value')
            
             # Extract Dropdown Options
             session_years = []
             sy_select = soup.find('select', id='SessionYear')
             if sy_select:
                 session_years = [{"Value": opt['value'], "Text": opt.text.strip()} for opt in sy_select.find_all('option') if opt['value']]

             years = []
             y_select = soup.find('select', id='Year')
             if y_select:
                 years = [{"Value": opt['value'], "Text": opt.text.strip()} for opt in y_select.find_all('option') if opt['value']]

             # Store these in the session for later use
             session.student_data = student_data
             session.hidden_fields = hidden_fields
             
             # Save for inspection
             with open("result_page.html", "w", encoding="utf-8") as f:
                f.write(post_resp.text)
             
             return jsonify({
                 "success": True, 
                 "message": "Login Successful",
                 "student_data": student_data,
                 "hidden_fields": hidden_fields,
                 "session_years": session_years,
                 "years": years
             })
             
        # Fallback
        return jsonify({"success": False, "message": "Could not fetch details. Check RollNo/DOB.", "debug_html_snippet": post_resp.text[:200]}), 401

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/semesters', methods=['GET'])
def get_semesters():
    session_id = request.args.get('session_id')
    if not session_id or session_id not in sessions:
        return jsonify({"error": "Invalid or expired session"}), 400

    session = sessions[session_id]
    hidden_fields = getattr(session, 'hidden_fields', {})
    branch_id = hidden_fields.get('hdnBranchId')
    
    if not branch_id:
        return jsonify({"error": "Branch ID not found. Please login again."}), 400
        
    try:
        url = f"{BASE_URL}/ums/Admission/Master/GetCourseBranchDurationForAttendance"
        resp = session.get(url, params={'BranchId': branch_id})
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        logger.error(f"Semester fetch error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/attendance', methods=['POST'])
def get_attendance():
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({"error": "Invalid or expired session"}), 400

    session = sessions[session_id]
    hidden_fields = getattr(session, 'hidden_fields', {})
    
    # Required params from frontend
    session_year = data.get('session_year', '2025') # Default to current
    semester_id = data.get('semester_id')
    year = data.get('year', '2025')
    month_id = data.get('month_id')
    
    logger.info(f"Attendance Request Data: session_year={session_year}, semester_id={semester_id}, year={year}, month_id={month_id}, roll_no={data.get('roll_no')}")
    logger.info(f"Checking Session ID: {session_id}")
    logger.info(f"Active Session IDs in memory: {list(sessions.keys())}")
    
    if not session_id or session_id not in sessions:
        logger.error(f"Session {session_id} NOT FOUND in active sessions!")
        return jsonify({"error": "Invalid or expired session"}), 400

    session = sessions[session_id]
    hidden_fields = getattr(session, 'hidden_fields', {})
    
    # Params from hidden fields
    payload = {
        "CollegeId": hidden_fields.get('hdnCollegeId'),
        "CourseId": hidden_fields.get('hdnCourseId'),
        "BranchId": hidden_fields.get('hdnBranchId'),
        "StudentAdmissionId": hidden_fields.get('hdnStudentAdmissionId'),
        "CourseBranchDurationId": semester_id,
        "SessionYear": session_year,
        "Year": year,
        "MonthId": month_id,
        "RollNo": data.get('roll_no'), 
        "DateOfBirth": data.get('dob') 
    }
    
    try:
        if str(month_id) == '0':
            # Fetch all months and aggregate
            logger.info("Fetching all months...")
            import concurrent.futures
            
            aggregated_data = {} # { "Subject Name": { "held": 0, "attended": 0 } }
            
            def fetch_month(m):
                local_payload = payload.copy()
                local_payload['MonthId'] = str(m)
                try:
                    url = f"{BASE_URL}/ums/Student/Public/ShowStudentAttendanceListByRollNoDOB"
                    r = session.get(url, params=local_payload)
                    r.raise_for_status()
                    
                    # Parse JSON wrapper if present
                    try:
                        content = r.json()
                    except:
                        content = r.text
                        
                    s = BeautifulSoup(content, 'html.parser')
                    t = s.find('table')
                    if not t: 
                        logger.warning(f"Month {m}: No table found in response.")
                        return
                    
                    rows = t.find_all('tr')
                    logger.info(f"Month {m}: Found {len(rows)} rows.")

                    # Find column indices
                    headers = [th.text.strip().lower() for th in t.find_all('th')]
                    idx_held = -1
                    idx_attended = -1
                    
                    for i, h in enumerate(headers):
                        if 'held' in h: idx_held = i
                        if 'attended' in h and '%' not in h: idx_attended = i
                            
                    # Fallback
                    if idx_held == -1: idx_held = len(headers) - 3
                    if idx_attended == -1: idx_attended = len(headers) - 2
                    
                    for tr in rows:
                        cells = [td.text.strip() for td in tr.find_all('td')]
                        if not cells or len(cells) < 3: continue
                        
                        subj = cells[0]
                        if 'total' in subj.lower(): continue
                        
                        try:
                            h_val = int(cells[idx_held]) if cells[idx_held].isdigit() else 0
                            a_val = int(cells[idx_attended]) if cells[idx_attended].isdigit() else 0
                            
                            if subj not in aggregated_data:
                                aggregated_data[subj] = {"held": 0, "attended": 0}
                            
                            aggregated_data[subj]["held"] += h_val
                            aggregated_data[subj]["attended"] += a_val
                        except:
                            pass
                except Exception as ex:
                    logger.error(f"Error fetching month {m}: {ex}")

            # Fetch months 1-12 in parallel
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                executor.map(fetch_month, range(1, 13))
                
            # Construct final data list
            final_data = []
            for subj, counts in aggregated_data.items():
                h = counts['held']
                a = counts['attended']
                p = f"{(a/h*100):.2f}" if h > 0 else "0.00"
                final_data.append([subj, str(h), str(a), p])
            
            logger.info(f"Aggregated Data: Found {len(final_data)} subjects.")
            return jsonify({
                "html": "", # No HTML for aggregated view
                "attendance_data": final_data,
                "headers": ["Subject", "Total Classes Held", "Total Classes Attended", "Attended %"]
            })

        else:
            # Single month fetch (existing logic)
            url = f"{BASE_URL}/ums/Student/Public/ShowStudentAttendanceListByRollNoDOB"
            logger.info(f"Fetching single month {month_id} from {url}")
            resp = session.get(url, params=payload)
            resp.raise_for_status()
            
            # Parse HTML to JSON
            try:
                html_content = resp.json()
            except:
                html_content = resp.text
                
            soup = BeautifulSoup(html_content, 'html.parser')
            table = soup.find('table')
            attendance_data = []
            headers = []
            
            if table:
                logger.info("Table found in response.")
                # Extract headers
                headers = [th.text.strip() for th in table.find_all('th')]
                
                # Extract rows
                rows = table.find_all('tr')
                logger.info(f"Found {len(rows)} rows in table.")
                
                for tr in rows:
                    cells = tr.find_all('td')
                    if cells:
                        row = [td.text.strip() for td in cells]
                        attendance_data.append(row)
                logger.info(f"Extracted {len(attendance_data)} data rows.")
            else:
                logger.warning("NO TABLE FOUND in response!")
                # Log a snippet of response to see what we got
                logger.warning(f"Response snippet: {html_content[:500]}")
            
            return jsonify({
                "html": resp.text,
                "attendance_data": attendance_data,
                "headers": headers
            })

    except Exception as e:
        logger.error(f"Attendance fetch error: {e}")
        return jsonify({"error": str(e)}), 500

# --- MongoDB / Leaderboard Setup ---
import os
from pymongo import MongoClient
from datetime import datetime

import certifi

# Use env var for security, fallback to provided string for easy setup
MONGO_URI = os.environ.get('MONGO_URI', "mongodb+srv://kumaryog2005:p6Vdbr2S3zFSUWWc@cluster0.wtlqmjg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")

try:
    # Log which source we are using (masking password)
    masked_uri = MONGO_URI.split('@')[-1] if '@' in MONGO_URI else "Invalid URI Format"
    logger.info(f"Attempting MongoDB connection to: ...@{masked_uri}")
    
    # Explicitly set tlsCAFile to avoid SSL errors on Render/Linux
    # Also force tls=True to ensure we are using SSL
    ca_path = certifi.where()
    logger.info(f"Using CA Certificate at: {ca_path}")
    
    client = MongoClient(MONGO_URI, tls=True, tlsCAFile=ca_path)
    
    # Force a connection check
    client.admin.command('ping')
    
    db = client.ums_db
    users_collection = db.users
    logger.info("Connected to MongoDB Atlas successfully!")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    users_collection = None

@app.route('/api/debug/mongo', methods=['GET'])
def debug_mongo():
    """
    Debug endpoint to test MongoDB connection and return detailed errors.
    """
    try:
        # Re-attempt connection to get fresh error
        ca_path = certifi.where()
        client = MongoClient(MONGO_URI, tls=True, tlsCAFile=ca_path, serverSelectionTimeoutMS=5000)
        info = client.server_info() # Forces a call
        return jsonify({
            "status": "Connected",
            "version": info.get("version"),
            "ca_path": ca_path,
            "uri_masked": MONGO_URI.split('@')[-1] if '@' in MONGO_URI else "HIDDEN"
        })
    except Exception as e:
        return jsonify({
            "status": "Failed",
            "error": str(e),
            "type": str(type(e)),
            "ca_path": certifi.where()
        }), 500

@app.route('/api/leaderboard/join', methods=['POST'])
def join_leaderboard():
    if not users_collection:
        return jsonify({"error": "Database not connected"}), 503
        
    data = request.json
    roll_no = data.get('roll_no')
    name = data.get('name')
    percentage = data.get('percentage')
    
    if not all([roll_no, name, percentage]):
        return jsonify({"error": "Missing data"}), 400
        
    try:
        # Upsert user (Update if exists, Insert if new)
        users_collection.update_one(
            {"roll_no": roll_no},
            {"$set": {
                "name": name,
                "percentage": float(percentage),
                "last_updated": datetime.utcnow()
            }},
            upsert=True
        )
        return jsonify({"success": True, "message": "Joined leaderboard!"})
    except Exception as e:
        logger.error(f"Leaderboard join error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    if not users_collection:
        return jsonify({"error": "Database not connected"}), 503
        
    try:
        # Get top 50 users sorted by percentage (descending)
        top_users = list(users_collection.find({}, {"_id": 0, "name": 1, "percentage": 1, "roll_no": 1}).sort("percentage", -1).limit(50))
        return jsonify(top_users)
    except Exception as e:
        logger.error(f"Leaderboard fetch error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
