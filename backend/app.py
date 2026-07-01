from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
import os
import jwt
import requests
import threading
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

# Load environment variables from .env file
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")])

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

JWT_SECRET = os.getenv("JWT_SECRET_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ─────────────────────────────────────────
# HELPER: Create JWT token for a user
# ─────────────────────────────────────────
def create_token(user_id, email):
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

# ─────────────────────────────────────────
# HELPER: Verify JWT token from request
# ─────────────────────────────────────────
def verify_token(request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        return None

# ─────────────────────────────────────────
# ROUTE 1: Health check
# ─────────────────────────────────────────
@app.route("/")
def home():
    return jsonify({"message": "Hairdrama Task API is running!"})

# ─────────────────────────────────────────
# ROUTE 2: Google OAuth - Step 1
# ─────────────────────────────────────────
@app.route("/auth/google")
def google_login():
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={request.host_url}auth/google/callback"
        "&response_type=code"
        "&scope=openid email profile"
        "&access_type=offline"
    )
    return redirect(google_auth_url)

# ─────────────────────────────────────────
# ROUTE 3: Google OAuth - Step 2 (Callback)
# ─────────────────────────────────────────
@app.route("/auth/google/callback")
def google_callback():
    code = request.args.get("code")
    if not code:
        return redirect(f"{FRONTEND_URL}/login?error=no_code")

    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{request.host_url}auth/google/callback",
            "grant_type": "authorization_code",
        }
    )
    token_data = token_response.json()
    access_token = token_data.get("access_token")

    user_info_response = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    user_info = user_info_response.json()

    google_id = user_info.get("id")
    email = user_info.get("email")
    full_name = user_info.get("name")
    avatar_url = user_info.get("picture")

    existing = supabase.table("users").select("*").eq("email", email).execute()

    if existing.data:
        user = existing.data[0]
    else:
        new_user = supabase.table("users").insert({
            "email": email,
            "full_name": full_name,
            "avatar_url": avatar_url,
            "google_id": google_id
        }).execute()
        user = new_user.data[0]

    token = create_token(user["id"], user["email"])
    return redirect(f"{FRONTEND_URL}/auth/callback?token={token}")

# ─────────────────────────────────────────
# ROUTE 4: Get current logged in user
# ─────────────────────────────────────────
@app.route("/auth/me")
def get_me():
    payload = verify_token(request)
    if not payload:
        return jsonify({"error": "Unauthorized"}), 401

    user = supabase.table("users").select("*").eq("id", payload["user_id"]).execute()
    if not user.data:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user.data[0])

# ─────────────────────────────────────────
# ROUTE 5: Get all users
# ─────────────────────────────────────────
@app.route("/users")
def get_users():
    payload = verify_token(request)
    if not payload:
        return jsonify({"error": "Unauthorized"}), 401

    users = supabase.table("users").select("id, email, full_name, avatar_url").execute()
    return jsonify(users.data)

# ─────────────────────────────────────────
# ROUTE 6: Get all tasks
# ─────────────────────────────────────────
@app.route("/tasks")
def get_tasks():
    payload = verify_token(request)
    if not payload:
        return jsonify({"error": "Unauthorized"}), 401

    tasks = supabase.table("tasks").select("*").execute()
    return jsonify(tasks.data)

# ─────────────────────────────────────────
# ROUTE 7: Create a new task
# ─────────────────────────────────────────
@app.route("/tasks", methods=["POST"])
def create_task():
    payload = verify_token(request)
    if not payload:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    new_task = supabase.table("tasks").insert({
        "title": data["title"],
        "description": data.get("description", ""),
        "status": "todo",
        "created_by": payload["user_id"],
        "assigned_to": data.get("assigned_to"),
        "due_date": data.get("due_date")
    }).execute()

    task = new_task.data[0]

    # Send email in background thread (non-blocking)
    if task.get("assigned_to"):
        thread = threading.Thread(
            target=send_email_notification,
            args=(task, "task_assigned")
        )
        thread.daemon = True
        thread.start()

    return jsonify(task), 201

# ─────────────────────────────────────────
# ROUTE 8: Update task
# ─────────────────────────────────────────
@app.route("/tasks/<task_id>", methods=["PATCH"])
def update_task(task_id):
    payload = verify_token(request)
    if not payload:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()

    old_task = supabase.table("tasks").select("*").eq("id", task_id).execute()
    old_status = old_task.data[0]["status"] if old_task.data else None

    updated = supabase.table("tasks").update(data).eq("id", task_id).execute()
    task = updated.data[0]

    # Send email in background thread (non-blocking)
    if data.get("status") == "completed" and old_status != "completed":
        thread = threading.Thread(
            target=send_email_notification,
            args=(task, "task_completed")
        )
        thread.daemon = True
        thread.start()

    return jsonify(task)

# ─────────────────────────────────────────
# ROUTE 9: Delete a task
# ─────────────────────────────────────────
@app.route("/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    payload = verify_token(request)
    if not payload:
        return jsonify({"error": "Unauthorized"}), 401

    supabase.table("tasks").delete().eq("id", task_id).execute()
    return jsonify({"message": "Task deleted"})

# ─────────────────────────────────────────
# HELPER: Send email notification
# ─────────────────────────────────────────
def send_email_notification(task, notification_type):
    try:
        assigned_to = task.get("assigned_to")
        if not assigned_to:
            return

        user = supabase.table("users").select("email, full_name").eq("id", assigned_to).execute()
        if not user.data:
            return

        recipient_email = user.data[0]["email"]
        recipient_name = user.data[0]["full_name"]

        if notification_type == "task_assigned":
            subject = f"New Task Assigned: {task['title']}"
            body = (
                f"Hi {recipient_name},\n\n"
                f"A new task has been assigned to you:\n\n"
                f"Title: {task['title']}\n"
                f"Description: {task.get('description', 'No description')}\n"
                f"Due Date: {task.get('due_date', 'No due date')}\n\n"
                f"Login to view your tasks.\n\n"
                f"Hairdrama Tech"
            )
        else:
            subject = f"Task Completed: {task['title']}"
            body = (
                f"Hi {recipient_name},\n\n"
                f"The following task has been marked as completed:\n\n"
                f"Title: {task['title']}\n\n"
                f"Hairdrama Tech"
            )

        smtp_email = os.getenv("GMAIL_USER")
        smtp_password = os.getenv("GMAIL_APP_PASSWORD")

        if not smtp_email or not smtp_password:
            print("Gmail credentials not set")
            return

        msg = MIMEMultipart()
        msg["From"] = smtp_email
        msg["To"] = recipient_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, recipient_email, msg.as_string())

        supabase.table("notifications").insert({
            "task_id": task["id"],
            "sent_to": assigned_to,
            "type": notification_type
        }).execute()

        print(f"Email sent successfully to {recipient_email}")

    except Exception as e:
        print(f"Email error: {e}")

# ─────────────────────────────────────────
# Run the app
# ─────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)