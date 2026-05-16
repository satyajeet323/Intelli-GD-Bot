import os
import uuid
import sqlite3
import json
import subprocess
import requests as _ext_requests
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.genai as genai_new
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# === Flask App Setup ===
app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5000"])

# === Configuration ===
DB_FOLDER = 'sessions'
os.makedirs(DB_FOLDER, exist_ok=True)

# === Gemini API Configuration ===
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

_gemini_client = genai_new.Client(api_key=GEMINI_API_KEY)
GEMINI_MODEL = "gemini-2.5-flash"

def _generate(prompt):
    response = _gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return response.text

# === Helper Functions ===
def get_db_path(session_id):
    """Get the path for a session-specific SQLite database"""
    return os.path.join(DB_FOLDER, f"{session_id}.db")

# =============================================================================
# NETWORKING ROUTES (from original app1.py)
# =============================================================================

@app.route('/generate-network-question', methods=['GET'])
def generate_network_question():
    prompt = """
Generate a clear and concise networking scenario question for students that involves designing IP configurations and network device setups. The question should be practical and test the understanding of subnetting, IP addressing, routing, and gateway configuration.

The scenario involves two PCs (or end devices) that need to communicate. Randomly choose one of the following cases and clearly state it in the question:

1. Both PCs are in the same subnet.
2. The PCs are in different subnets within the same overall network.
3. The PCs are in different networks requiring routing between them.

Assume the subnet mask is always 255.255.255.0.

Limit the maximum number of routers to two (or fewer).

The question should ask the student to:
- Assign suitable IP addresses to both PCs based on the chosen scenario.
- Specify any required network devices and their configuration (routers, switches).
- Provide gateway settings for the PCs and routers if needed.

Write the question clearly and in a student-friendly manner without giving away the solution or assumptions about the number of routers/devices needed.

"""
    try:
        question_text = _generate(prompt).strip()

        # Strip markdown code blocks if present
        if question_text.startswith("```"):
            question_text = question_text.strip("```").strip()

        return jsonify({"status": "success", "question": question_text})

    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to generate question: {e}"}), 500


@app.route('/evaluate-network', methods=['POST'])
def evaluate_network():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No JSON data received"}), 400
        
    network_data = data.get('config')
    question = data.get('question')

    # Basic validation
    if not network_data or 'nodes' not in network_data or 'edges' not in network_data:
        return jsonify({"status": "error", "message": "Invalid network JSON"}), 400

    prompt = f"""
    You are a network configuration evaluator.
    
    First, give a clear and concise overall verdict about the correctness of the provided network configuration with respect to the question. If correct then 5/5 and if incorrect then 0/5. No mid marks here. 
    Start with a sentence like:

    - "Your Score is : Given Score."
    
    - "The network configuration is correct and meets the requirements."
    - OR "The network configuration is incomplete and does not fully meet the requirements."
    
    After this verdict, provide a detailed explanation divided into numbered points covering:
    
    1. IP Addressing for PCs
    2. Network Devices and Configuration
    3. Gateway Settings
    
    Use clear, human-like sentences with bullet points or numbered lists for explanation. 
    Do not just return raw JSON — respond in friendly, easy-to-read paragraphs.
    
    Here is the question:
    {json.dumps(question, indent=2)}
    
    Here is the network configuration JSON:
    {json.dumps(network_data, indent=2)}
    """

    try:
        text = _generate(prompt).strip()

        # Clean code block markdown if present
        if text.startswith("```json"):
            text = text.replace("```json", "").replace("```", "").strip()

        return jsonify({"status": "success", "evaluation": text})

    except Exception as e:
        return jsonify({"status": "error", "message": f"Gemini evaluation failed: {e}"}), 500

# =============================================================================
# SQL PRACTICE ROUTES (from original app1.py)
# =============================================================================

@app.route('/generate-sql-question', methods=['GET'])
def generate_sql_question():
    prompt = """
Generate a beginner-friendly SQL practice question.

Return JSON like:
{
  "question": "Write a query to list names of employees earning more than 50000.",
  "setup_sql": "CREATE TABLE employees (id INT, name TEXT, salary INT);\\nINSERT INTO employees VALUES (1, 'John', 45000), (2, 'Alice', 60000), (3, 'Bob', 70000);"
}

Use only simple SELECT + WHERE (no joins).
"""
    try:
        content = _generate(prompt).strip()

        # Strip code block markers
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()

        qdata = json.loads(content)
        return jsonify({"status": "success", "data": qdata})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Gemini generation failed: {e}"}), 500

@app.route('/run-setup', methods=['POST'])
def run_setup():
    data = request.json
    setup_sql = data.get('setup_sql')
    session_id = data.get('session_id', str(uuid.uuid4()))

    db_path = get_db_path(session_id)

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.executescript(setup_sql)
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "session_id": session_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    

@app.route('/get-table', methods=['POST'])
def get_table():
    data = request.json
    session_id = data.get('session_id')
    table_name = data.get('table_name')  # optional

    db_path = get_db_path(session_id)

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Try to detect table name if not provided
        if not table_name:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            if not tables:
                return jsonify({"status": "error", "message": "No tables found"})
            table_name = tables[0][0]  # just pick the first

        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        col_names = [desc[0] for desc in cursor.description]

        result = {
            "columns": col_names,
            "rows": rows
        }

        return jsonify({"status": "success", "data": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route('/run-query', methods=['POST'])
def run_query():
    data = request.json
    session_id = data.get('session_id')
    user_query = data.get('user_query')

    db_path = get_db_path(session_id)

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(user_query)

        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()

        conn.close()
        return jsonify({
            "status": "success",
            "columns": columns,
            "rows": rows
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/evaluate-sql', methods=['POST'])
def evaluate_sql():
    data = request.json
    question = data.get('question')
    setup_sql = data.get('setup_sql')
    user_query = data.get('user_query')
    user_output = data.get('user_output')

    prompt = f"""
You are an SQL evaluator. A student is attempting a database problem.

Problem Statement:
{question}

Reference Setup SQL:
{setup_sql}

User's SQL Query:
{user_query}

User's Output:
{user_output}

Please evaluate:
- Is the query correct based on the question?
- If incorrect, give a short reason and the correct query.
- Give a score out of 5.

Return JSON like:
{{
  "is_correct": true/false,
  "score": 0-5,
  "feedback": "brief feedback",
  "suggested_query": "correct query if applicable"
}}
"""
    try:
        gemini_text = _generate(prompt).strip()

        if gemini_text.startswith("```json"):
            gemini_text = gemini_text.replace("```json", "").replace("```", "").strip()

        eval_result = json.loads(gemini_text)
        return jsonify({"status": "success", "evaluation": eval_result})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Gemini evaluation failed: {e}"}), 500

# =============================================================================
# CODING PRACTICE ROUTES (from app2py)
# =============================================================================

@app.route('/generate-coding-question', methods=['GET'])
def generate_coding_question():
    prompt = """
    Generate a beginner to intermediate level programming question that can be solved in Python, C, C++, or Java.
    The question should be clear, concise, and require around 10–30 lines of code which does not require any input. Avoid advanced topics.
    Provide only the question statement without code or answer. 
    """

    try:
        question = _generate(prompt).strip()
        return jsonify({'question': question})
    except Exception as e:
        return jsonify({'error': f'Gemini error: {str(e)}'}), 500

@app.route('/run-code', methods=['POST'])
def run_code():
    data = request.get_json()
    code = data.get('code')
    language = data.get('language')
    question = data.get('question')

    if not code or not language or not question:
        return jsonify({'error': 'Missing code, language, or question'}), 400

    # Create temp directory for code files
    temp_dir = os.path.join(os.getcwd(), 'temp_code')
    os.makedirs(temp_dir, exist_ok=True)

    filename = ''
    run_cmd = ''
    volume_path = temp_dir.replace("\\", "/")
    unique_id = str(uuid.uuid4())[:8]

    if language == 'python':
        filename = f'{unique_id}.py'
        run_cmd = f'python /code/{filename}'
        docker_image = 'python:3.9'
        local_cmd = f'python {filename}'
    elif language == 'c':
        filename = f'{unique_id}.c'
        run_cmd = f'/bin/sh -c "gcc /code/{filename} -o /code/a.out && /code/a.out"'
        docker_image = 'gcc'
        local_cmd = f'gcc {filename} -o {unique_id}.exe && {unique_id}.exe'
    elif language == 'cpp':
        filename = f'{unique_id}.cpp'
        run_cmd = f'/bin/sh -c "g++ /code/{filename} -o /code/a.out && /code/a.out"'
        docker_image = 'gcc'
        local_cmd = f'g++ {filename} -o {unique_id}.exe && {unique_id}.exe'
    elif language == 'java':
        filename = f'Main{unique_id}.java'
        run_cmd = f'/bin/sh -c "javac /code/{filename} && java -cp /code Main{unique_id}"'
        docker_image = 'openjdk'
        local_cmd = f'javac {filename} && java Main{unique_id}'
    else:
        return jsonify({'error': 'Unsupported language'}), 400

    file_path = os.path.join(temp_dir, filename)
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)
    except Exception as e:
        return jsonify({'error': f'Failed to write code file: {str(e)}'}), 500

    output = ''
    execution_method = 'docker'  # Track which method was used
    
    try:
        # First try Docker execution
        docker_command = f'docker run --rm -v "{volume_path}:/code" {docker_image} {run_cmd}'
        print(f"Attempting Docker execution: {docker_image}")
        
        result = subprocess.run(
            docker_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=15,
            shell=True,
            text=True
        )
        
        # Check if Docker error is about Docker not running
        if 'cannot find the file specified' in result.stderr.lower() or 'docker daemon' in result.stderr.lower():
            raise FileNotFoundError("Docker is not running")
        
        output = result.stdout + result.stderr
        
        if result.returncode != 0 and not output.strip():
            raise subprocess.CalledProcessError(result.returncode, docker_command)
            
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError, OSError) as e:
        error_msg = str(e).lower()
        print(f"Docker execution failed: {str(e)}")
        
        # Fallback to local execution
        if language == 'python':
            try:
                print(f"Falling back to local Python execution")
                execution_method = 'local'
                result = subprocess.run(
                    local_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=10,
                    shell=True,
                    text=True,
                    cwd=temp_dir
                )
                output = result.stdout + result.stderr
                if not output.strip() and result.returncode == 0:
                    output = "Code executed successfully (no output)"
            except subprocess.TimeoutExpired:
                output = 'Error: Code execution timed out (10 seconds)'
            except Exception as local_e:
                output = f'Error: Local Python execution failed - {str(local_e)}\n\nPlease ensure Python is installed and in your PATH.'
        elif language in ['c', 'cpp']:
            # Try local GCC/G++ if available
            try:
                print(f"Attempting local {language.upper()} compilation")
                execution_method = 'local'
                result = subprocess.run(
                    local_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=15,
                    shell=True,
                    text=True,
                    cwd=temp_dir
                )
                output = result.stdout + result.stderr
                if not output.strip() and result.returncode == 0:
                    output = "Code executed successfully (no output)"
            except Exception as local_e:
                output = f'Docker is not running and local {language.upper()} compiler not found.\n\nTo run {language.upper()} code:\n1. Install Docker Desktop and start it, OR\n2. Install MinGW (for Windows) or GCC (for Linux/Mac)'
        elif language == 'java':
            # Try local Java if available
            try:
                print(f"Attempting local Java compilation")
                execution_method = 'local'
                result = subprocess.run(
                    local_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=15,
                    shell=True,
                    text=True,
                    cwd=temp_dir
                )
                output = result.stdout + result.stderr
                if not output.strip() and result.returncode == 0:
                    output = "Code executed successfully (no output)"
            except Exception as local_e:
                output = f'Docker is not running and local Java compiler not found.\n\nTo run Java code:\n1. Install Docker Desktop and start it, OR\n2. Install JDK (Java Development Kit)'
        else:
            output = f'Error: Docker is not running and local execution not supported for {language}.\n\nPlease start Docker Desktop to run {language} code.'
    
    except Exception as e:
        output = f'Error: Unexpected execution error - {str(e)}'
    
    finally:
        # Clean up files
        cleanup_files = [
            file_path,
            os.path.join(temp_dir, 'a.out'),
            os.path.join(temp_dir, f'{unique_id}.exe'),
            os.path.join(temp_dir, f'Main{unique_id}.class')
        ]
        
        for cleanup_file in cleanup_files:
            try:
                if os.path.exists(cleanup_file):
                    os.remove(cleanup_file)
            except Exception as cleanup_e:
                print(f"Warning: Failed to cleanup {cleanup_file}: {str(cleanup_e)}")

    # Gemini Evaluation
    eval_prompt = f"""
    Evaluate the following solution for a programming problem.

    **Question:**
    {question}

    **Language:** {language}

    **Code:**
    ```{language}
    {code}
    ```

    **Output:**
    {output}

    Give a clear, concise evaluation: is the code correct, are there logic flaws, what edge cases are missing, and how can it be improved?
    """

    try:
        ai_feedback = _generate(eval_prompt)
    except Exception as e:
        ai_feedback = f"AI Evaluation Failed: {str(e)}"

    # Add execution method info to output
    if execution_method == 'local':
        output = f"[Executed locally - Docker not available]\n\n{output}"
    
    return jsonify({
        'output': output,
        'ai_feedback': ai_feedback,
        'execution_method': execution_method
    })

# =============================================================================
# FLUENCY ROUTES - English Fluency Assessment
# =============================================================================

@app.route('/api/fluency/topic', methods=['GET'])
def generate_fluency_topic():
    """Generate a topic for English fluency assessment"""
    try:
        prompt = "Give a single open-ended topic related to technologies, current events, or general knowledge that would be suitable for a 1-minute English speaking assessment. Reply with topic only, no additional text."
        
        topic = _generate(prompt).strip()
        
        if not topic:
            raise ValueError("Empty topic generated")
            
        return jsonify({"topic": topic})
    except Exception as e:
        print(f"Error generating fluency topic: {str(e)}")
        # Fallback topics if AI fails
        fallback_topics = [
            "Describe the impact of social media on modern communication",
            "Explain the benefits and challenges of remote work",
            "Discuss the role of artificial intelligence in education",
            "Share your thoughts on sustainable living and environmental protection",
            "Describe how technology has changed the way we learn new skills"
        ]
        import random
        return jsonify({"topic": random.choice(fallback_topics)})

@app.route('/api/fluency/upload', methods=['POST'])
def upload_fluency_audio():
    """
    Receive a WebM audio file, transcribe it with Whisper via the FastAPI
    service (main.py on port 8000), and return the real transcript + prosody.
    Falls back to a minimal error response — never returns mock data.
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400

        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Forward the audio to the FastAPI service (main.py) which runs Whisper
        fastapi_url = os.getenv("PYTHON_SERVICE_URL", "http://localhost:8000")
        files = {"audio": (audio_file.filename or "audio.webm",
                           audio_file.stream,
                           audio_file.content_type or "audio/webm")}
        resp = _ext_requests.post(
            f"{fastapi_url}/api/fluency/upload",
            files=files,
            timeout=120
        )
        resp.raise_for_status()
        return jsonify(resp.json())

    except Exception as e:
        import traceback
        print(f"[ERROR] upload_fluency_audio:\n{traceback.format_exc()}")
        return jsonify({'error': f'Failed to process audio: {str(e)}'}), 500


        
@app.route('/api/fluency/score', methods=['POST'])
def score_fluency():
    """
    Score fluency by forwarding the transcript + prosody to the FastAPI
    service (main.py on port 8000) which calls Gemini with the real data.
    Never returns mock/static scores.
    """
    try:
        data = request.get_json()
        transcript = (data or {}).get('transcript', '').strip()
        topic = (data or {}).get('topic', '').strip()

        if not transcript or not topic:
            return jsonify({'error': 'Transcript and topic are required'}), 400

        fastapi_url = os.getenv("PYTHON_SERVICE_URL", "http://localhost:8000")
        resp = _ext_requests.post(
            f"{fastapi_url}/api/fluency/score",
            json=data,
            headers={"Content-Type": "application/json"},
            timeout=90
        )
        resp.raise_for_status()
        return jsonify(resp.json())

    except Exception as e:
        print(f"Error scoring fluency: {str(e)}")
        return jsonify({'error': f'Failed to score fluency: {str(e)}'}), 500

if __name__ == '__main__':
    # Run without debug mode to avoid file watching issues
    app.run(port=6000, debug=False, host='127.0.0.1')
