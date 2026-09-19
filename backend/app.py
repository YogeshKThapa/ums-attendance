import os
import re
import json
import logging
import uuid
import base64
from datetime import datetime
from dotenv import load_dotenv
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
import redis

# Load environment variables from .env
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RECENT_LOGS = []
class MemoryLogHandler(logging.Handler):
    def emit(self, record):
        try:
            msg = self.format(record)
            RECENT_LOGS.append(f"{datetime.utcnow().strftime('%H:%M:%S')} [{record.levelname}] {msg}")
            if len(RECENT_LOGS) > 100:
                RECENT_LOGS.pop(0)
        except Exception:
            pass

mem_handler = MemoryLogHandler()
mem_handler.setLevel(logging.INFO)
logging.getLogger().addHandler(mem_handler)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})  # Explicitly enable CORS for API routes

@app.route('/api/debug/logs', methods=['GET'])
def get_debug_logs():
    return jsonify({"logs": RECENT_LOGS[-50:]})

# --- Redis Connection Setup ---
redis_url = os.environ.get("UPSTASH_REDIS_URL")
redis_client = None
if redis_url:
    try:
        redis_client = redis.from_url(redis_url)
        logger.info("Connected to Upstash Redis.")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
else:
    logger.warning("UPSTASH_REDIS_URL environment variable not found. Redis features will fall back to memory.")

class SessionStore:
    """
    Manages user requests.Session instances.
    If Redis is available, sessions are serialized as JSON and stored in Redis.
    Otherwise, falls back to a standard in-memory dictionary.
    """
    def __init__(self, r_client=None):
        self.redis_client = r_client
        self.memory_sessions = {}

    def get(self, session_id):
        if not session_id:
            return None
        
        if self.redis_client:
            try:
                data_str = self.redis_client.get(f"session:{session_id}")
                if data_str:
                    data = json.loads(data_str)
                    session = requests.Session()
                    # Reconstruct cookies from stored dict
                    cookie_dict = data.get("cookies", {})
                    cookie_jar = requests.utils.cookiejar_from_dict(cookie_dict)
                    session.cookies.update(cookie_jar)
                    # Reconstruct custom properties
                    session.student_data = data.get("student_data", {})
                    session.hidden_fields = data.get("hidden_fields", {})
                    return session
            except Exception as e:
                logger.error(f"Redis get session error: {e}")

        # Fallback to memory
        return self.memory_sessions.get(session_id)

    def save(self, session_id, session):
        if not session_id or not session:
            return

        if self.redis_client:
            try:
                cookie_dict = requests.utils.dict_from_cookiejar(session.cookies)
                student_data = getattr(session, 'student_data', {})
                hidden_fields = getattr(session, 'hidden_fields', {})
                data = {
                    "cookies": cookie_dict,
                    "student_data": student_data,
                    "hidden_fields": hidden_fields
                }
                # Store in Redis with 2 hours TTL (7200 seconds)
                self.redis_client.set(f"session:{session_id}", json.dumps(data), ex=7200)
                return
            except Exception as e:
                logger.error(f"Redis save session error: {e}")

        # Fallback to memory
        self.memory_sessions[session_id] = session

    def exists(self, session_id):
        if not session_id:
            return False
        if self.redis_client:
            try:
                return self.redis_client.exists(f"session:{session_id}") > 0
            except Exception as e:
                logger.error(f"Redis exists check error: {e}")
        return session_id in self.memory_sessions

# Instantiate global session store
session_store = SessionStore(redis_client)

# --- Attendance Caching Helpers ---
def get_cached_attendance(roll_no, semester_id, session_year, year, month_id):
    if not redis_client or not roll_no:
        return None
    try:
        cache_key = f"cache:attendance:{roll_no}:{semester_id}:{session_year}:{year}:{month_id}"
        cached = redis_client.get(cache_key)
        if cached:
            logger.info(f"Cache hit for attendance: {cache_key}")
            return json.loads(cached)
    except Exception as e:
        logger.error(f"Error reading attendance cache: {e}")
    return None

def set_cached_attendance(roll_no, semester_id, session_year, year, month_id, data, ex=7200):
    if not redis_client or not roll_no:
        return
    try:
        cache_key = f"cache:attendance:{roll_no}:{semester_id}:{session_year}:{year}:{month_id}"
        redis_client.set(cache_key, json.dumps(data), ex=ex)
        logger.info(f"Cached attendance under key: {cache_key}")
    except Exception as e:
        logger.error(f"Error writing attendance cache: {e}")

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

    try:
        # 1. Get Page
        resp = session.get(LOGIN_URL)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        # Extract Request Verification Token
        token_tag = soup.find('input', {'name': '__RequestVerificationToken'})
        verification_token = token_tag.get('value') if token_tag else None
        logger.info(f"Extracted __RequestVerificationToken: {verification_token}")
        
        # Initialize hidden_fields with the token
        session.hidden_fields = {'__RequestVerificationToken': verification_token}

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

        # Save session to store (persisting cookies)
        session_store.save(session_id, session)

        return jsonify({
            "session_id": session_id,
            "captcha_image": f"data:image/png;base64,{captcha_b64}"
        })

    except Exception as e:
        logger.error(f"Init error: {e}")
        return jsonify({"error": str(e)}), 500

def normalize_dob(dob_str):
    if not dob_str:
        return ''
    cleaned = str(dob_str).strip().replace('-', '/')
    parts = cleaned.split('/')
    if len(parts) == 3 and len(parts[0]) == 4:  # YYYY/MM/DD -> DD/MM/YYYY
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return cleaned

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    session_id = data.get('session_id')
    roll_no = str(data.get('login_id', '')).strip() # Reuse login_id field for RollNo
    dob = normalize_dob(data.get('password', ''))    # Reuse password field for DOB
    captcha_text = str(data.get('captcha_text', '')).strip()

    session = session_store.get(session_id)
    if not session:
        return jsonify({"error": "Invalid or expired session"}), 400

    hidden_fields = getattr(session, 'hidden_fields', {})
    verification_token = hidden_fields.get('__RequestVerificationToken')
    logger.info(f"Retrieved __RequestVerificationToken for login: {verification_token}")

    # No encryption needed for this public form based on inspection
    payload = {
        "__RequestVerificationToken": verification_token,
        "RollNo": roll_no,
        "DateOfBirth": dob,
        "Captcha": captcha_text,
        "btnSubmit": "Login"
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
        
        # Check for specific error messages (SweetAlert and inline warnings)
        if "Kindly Enter Valid Captcha" in post_resp.text or "Invalid Captcha" in post_resp.text or "Enter Valid Captcha" in post_resp.text:
             logger.warning("Result: Invalid Captcha")
             return jsonify({"success": False, "message": "Invalid CAPTCHA"}), 401
        
        # Parse the response to check student details and hidden fields
        soup = BeautifulSoup(post_resp.text, 'html.parser')
        
        lbl_student = soup.find('label', id='lblStudentName') or soup.find(id='lblStudentName')
        student_name = lbl_student.text.strip() if lbl_student else ""
        
        hidden_fields = {}
        for hid in ['hdnCollegeId', 'hdnBranchId', 'hdnCourseId', 'hdnStudentAdmissionId']:
            tag = soup.find('input', id=hid) or soup.find('input', attrs={'name': hid})
            if not tag:
                unprefixed = hid.replace('hdn', '')
                tag = soup.find('input', id=unprefixed) or soup.find('input', attrs={'name': unprefixed})
            if tag and tag.get('value'):
                hidden_fields[hid] = tag.get('value')
        
        # Also extract post-login __RequestVerificationToken and Token for attendance requests
        token_tag = soup.find('input', {'name': '__RequestVerificationToken'})
        if token_tag and token_tag.get('value'):
            hidden_fields['__RequestVerificationToken'] = token_tag.get('value')
        else:
            hidden_fields['__RequestVerificationToken'] = verification_token

        token_input = soup.find(id='Token') or soup.find(attrs={'name': 'Token'})
        hidden_fields['Token'] = token_input.get('value') if token_input and token_input.get('value') else ''

        # Verify authentic login: student name or admission ID must be present
        admission_id = hidden_fields.get('hdnStudentAdmissionId')
        if not student_name and not admission_id:
            logger.warning(f"Result: Student details not found for RollNo {roll_no}. Snippet: {post_resp.text[:400]}")
            swal_match = re.search(r"swal\(\s*['\"]([^'\"]+)['\"]", post_resp.text)
            error_msg = swal_match.group(1) if swal_match else "Could not fetch details. Please check Roll No / DOB."
            return jsonify({"success": False, "message": error_msg, "debug_html_snippet": post_resp.text[:200]}), 401
        
        logger.info(f"Result: Success for {student_name or roll_no} (AdmissionId: {admission_id})")
        
        student_data = {
            "student_name": student_name,
            "father_name": soup.find('label', id='lblFatherName').text.strip() if soup.find('label', id='lblFatherName') else "Unknown",
            "course_name": soup.find('label', id='CourseName').text.strip() if soup.find('label', id='CourseName') else "Unknown",
            "branch_name": soup.find('label', id='BranchName').text.strip() if soup.find('label', id='BranchName') else "Unknown",
        }
        
        # Extract Dropdown Options
        session_years = []
        sy_select = soup.find('select', id='SessionYear')
        if sy_select:
            session_years = [{"Value": opt['value'], "Text": opt.text.strip()} for opt in sy_select.find_all('option') if opt.get('value')]

        years = []
        y_select = soup.find('select', id='Year')
        if y_select:
            years = [{"Value": opt['value'], "Text": opt.text.strip()} for opt in y_select.find_all('option') if opt.get('value')]

        # Store these in the session for later use
        session.student_data = student_data
        session.hidden_fields = hidden_fields
        
        # Save session to store (persisting credentials and cookies)
        session_store.save(session_id, session)
        
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

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/semesters', methods=['GET'])
def get_semesters():
    session_id = request.args.get('session_id')
    session = session_store.get(session_id)
    if not session:
        return jsonify({"error": "Invalid or expired session"}), 400

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
    
    session = session_store.get(session_id)
    if not session:
        logger.error(f"Session {session_id} NOT FOUND in session store!")
        return jsonify({"error": "Invalid or expired session"}), 400

    hidden_fields = getattr(session, 'hidden_fields', {})
    
    # Required/optional params from frontend
    session_year = data.get('session_year', '2025') # Default to current
    semester_id = data.get('semester_id')
    year = data.get('year', '2026')
    month_id = data.get('month_id')
    roll_no = str(data.get('roll_no', '')).strip()
    dob = normalize_dob(data.get('dob', ''))
    bypass_cache = data.get('bypass_cache', False)
    
    logger.info(f"Attendance Request Data: session_year={session_year}, semester_id={semester_id}, year={year}, month_id={month_id}, roll_no={roll_no}")

    # Check cache first if not bypass_cache
    if not bypass_cache:
        cached_result = get_cached_attendance(roll_no, semester_id, session_year, year, month_id)
        if cached_result is not None:
            return jsonify(cached_result)
    
    post_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': LOGIN_URL,
        'Origin': BASE_URL,
        'X-Requested-With': 'XMLHttpRequest'
    }

    # Params for ShowStudentAttendanceListByRollNoDOB POST endpoint
    verification_token = hidden_fields.get('__RequestVerificationToken', '')
    token_val = hidden_fields.get('Token', '')
    
    payload = {
        "__RequestVerificationToken": verification_token,
        "Token": token_val,
        "SessionYear": str(session_year) if session_year else "",
        "CourseBranchDurationId": str(semester_id) if semester_id else "",
        "Year": str(year) if year else "",
        "MonthId": str(month_id) if month_id else "",
        # Legacy/fallback parameters
        "CollegeId": hidden_fields.get('hdnCollegeId', ''),
        "CourseId": hidden_fields.get('hdnCourseId', ''),
        "BranchId": hidden_fields.get('hdnBranchId', ''),
        "StudentAdmissionId": hidden_fields.get('hdnStudentAdmissionId', ''),
        "RollNo": roll_no or '', 
        "DateOfBirth": dob or ''
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
                    r = session.post(url, data=local_payload, headers=post_headers)
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
                            tch_cell = tr.find(class_=lambda c: c and 'clsTCH' in c)
                            tp_cell = tr.find(class_=lambda c: c and 'clsTP' in c)

                            if tch_cell and tp_cell:
                                tch_text = tch_cell.text.strip()
                                tp_text = tp_cell.text.strip()
                                h_val = int(tch_text) if tch_text.isdigit() else 0
                                a_val = int(tp_text) if tp_text.isdigit() else 0
                            else:
                                h_val = int(cells[idx_held]) if (0 <= idx_held < len(cells) and cells[idx_held].isdigit()) else 0
                                a_val = int(cells[idx_attended]) if (0 <= idx_attended < len(cells) and cells[idx_attended].isdigit()) else 0
                            
                            if subj not in aggregated_data:
                                aggregated_data[subj] = {"held": 0, "attended": 0}
                            
                            aggregated_data[subj]["held"] += h_val
                            aggregated_data[subj]["attended"] += a_val
                        except Exception as parse_err:
                            logger.error(f"Error parsing row cells in month {m}: {parse_err}")
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
            
            result = {
                "html": "", # No HTML for aggregated view
                "attendance_data": final_data,
                "headers": ["Subject", "Total Classes Held", "Total Classes Attended", "Attended %"]
            }
            if final_data and len(final_data) > 0:
                set_cached_attendance(roll_no, semester_id, session_year, year, month_id, result)
            return jsonify(result)

        else:
            # Single month fetch (POST)
            url = f"{BASE_URL}/ums/Student/Public/ShowStudentAttendanceListByRollNoDOB"
            logger.info(f"Fetching single month {month_id} via POST from {url}")
            resp = session.post(url, data=payload, headers=post_headers)
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
            
            result = {
                "html": html_content,
                "attendance_data": attendance_data,
                "headers": headers
            }
            if attendance_data and len(attendance_data) > 0:
                set_cached_attendance(roll_no, semester_id, session_year, year, month_id, result)
            return jsonify(result)

    except Exception as e:
        logger.error(f"Attendance fetch error: {e}")
        return jsonify({"error": str(e)}), 500
# --- Redis Leaderboard Setup ---

# Redis client is initialized at the top of the file
# We reuse the same global redis_client here.

REDIS_LEADERBOARD_KEY = "UMS_LEADERBOARD"

def load_leaderboard():
    if not redis_client:
        logger.error("Redis client not initialized.")
        return {}
    try:
        data_str = redis_client.get(REDIS_LEADERBOARD_KEY)
        if data_str:
            data = json.loads(data_str)
            if isinstance(data, dict):
                return data
            else:
                logger.warning(f"Leaderboard data in Redis is not a dict: {type(data)}")
                return {}
        return {}
    except Exception as e:
        logger.error(f"Error loading leaderboard from Redis: {e}")
        return {}

def save_leaderboard(data):
    if not redis_client:
        logger.error("Redis client not initialized. Cannot save.")
        return
    try:
        redis_client.set(REDIS_LEADERBOARD_KEY, json.dumps(data))
        logger.info("Leaderboard saved successfully.")
    except Exception as e:
        logger.error(f"Error saving leaderboard to Redis: {e}")

@app.route('/api/leaderboard/join', methods=['POST'])
def join_leaderboard():
    try:
        data = request.json
        if not data:
             return jsonify({"error": "Invalid JSON body"}), 400

        roll_no = str(data.get('roll_no', ''))
        name = data.get('name', 'Unknown')
        percentage = data.get('percentage')
        
        if not roll_no or percentage is None:
            return jsonify({"error": "Missing required data fields (roll_no, percentage)"}), 400
            
        leaderboard = load_leaderboard()
        
        # Update or add user
        leaderboard[roll_no] = {
            "roll_no": roll_no,
            "name": name,
            "percentage": float(percentage),
            "last_updated": datetime.utcnow().isoformat()
        }
        
        save_leaderboard(leaderboard)
        return jsonify({"success": True, "message": "Joined leaderboard!"})

    except Exception as e:
        logger.error(f"Leaderboard join error: {e}", exc_info=True)
        return jsonify({"error": f"Internal Error: {str(e)}"}), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        if not redis_client:
             return jsonify({"error": "Leaderboard service unavailable (Redis disconnected)"}), 503

        leaderboard = load_leaderboard()
        # Convert dict to list
        users = list(leaderboard.values())
        
        # Ensure all users have numeric percentages for sorting
        for u in users:
            try:
                u['percentage'] = float(u.get('percentage', 0))
            except:
                u['percentage'] = 0.0

        # Sort by percentage descending
        users.sort(key=lambda x: x.get('percentage', 0), reverse=True)
        # Limit to top 50
        top_users = users[:50]
        
        logger.info(f"Returning {len(top_users)} leaderboard entries.")
        return jsonify(top_users)
    except Exception as e:
        logger.error(f"Leaderboard fetch error: {e}")
        return jsonify({"error": f"Failed to fetch rankings: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
