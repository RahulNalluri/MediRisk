import json

from database.connection import get_connection, now_iso, rows_to_dicts
from database.utils import normalize_language


def _validate_session_uid(session_uid):
    value = str(session_uid or "").strip()
    if not value:
        raise ValueError("Chat session ID is required")
    if len(value) > 128:
        raise ValueError("Chat session ID is too long")
    return value


def save_chat_exchange(
    session_uid,
    patient_id,
    user_message,
    assistant_message,
    language="en",
    intent=None,
    sources=None,
):
    session_uid = _validate_session_uid(session_uid)
    user_message = str(user_message or "").strip()
    assistant_message = str(assistant_message or "").strip()

    if not user_message or not assistant_message:
        raise ValueError("Both chat messages are required")

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, patient_id FROM chat_sessions WHERE session_uid = ?",
            (session_uid,),
        )
        session = cur.fetchone()

        if session and session["patient_id"] != patient_id:
            raise PermissionError("Chat session belongs to another patient")

        timestamp = now_iso()
        if session:
            session_id = session["id"]
            cur.execute(
                "UPDATE chat_sessions SET language = ?, updated_at = ? WHERE id = ?",
                (normalize_language(language), timestamp, session_id),
            )
        else:
            cur.execute(
                """
                SELECT COALESCE(
                    (SELECT hospital_id FROM visits WHERE patient_id = ? ORDER BY visit_date DESC LIMIT 1),
                    (SELECT u.hospital_id
                     FROM patients p
                     LEFT JOIN users u ON u.id = p.registered_by_user_id
                     WHERE p.id = ?)
                ) AS hospital_id
                """,
                (patient_id, patient_id),
            )
            hospital_row = cur.fetchone()
            hospital_id = hospital_row["hospital_id"] if hospital_row else None
            cur.execute(
                """
                INSERT INTO chat_sessions (
                    session_uid, patient_id, hospital_id, user_id,
                    language, created_at, updated_at
                ) VALUES (?, ?, ?, NULL, ?, ?, ?)
                """,
                (
                    session_uid,
                    patient_id,
                    hospital_id,
                    normalize_language(language),
                    timestamp,
                    timestamp,
                ),
            )
            session_id = cur.lastrowid

        cur.execute(
            """
            INSERT INTO chat_messages (
                session_id, sender, message_text, intent, sources_json, created_at
            ) VALUES (?, 'user', ?, NULL, NULL, ?)
            """,
            (session_id, user_message, timestamp),
        )
        cur.execute(
            """
            INSERT INTO chat_messages (
                session_id, sender, message_text, intent, sources_json, created_at
            ) VALUES (?, 'assistant', ?, ?, ?, ?)
            """,
            (
                session_id,
                assistant_message,
                intent,
                json.dumps(sources or [], ensure_ascii=False),
                timestamp,
            ),
        )
        conn.commit()
        return session_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_patient_chat_history(patient_id, session_limit=20, message_limit=500):
    session_limit = max(1, min(int(session_limit), 100))
    message_limit = max(1, min(int(message_limit), 2000))
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, session_uid, patient_id, hospital_id, language,
                   created_at, updated_at
            FROM chat_sessions
            WHERE patient_id = ?
            ORDER BY COALESCE(updated_at, created_at) DESC
            LIMIT ?
            """,
            (patient_id, session_limit),
        )
        sessions = rows_to_dicts(cur.fetchall())

        remaining = message_limit
        for session in sessions:
            if remaining <= 0:
                session["messages"] = []
                continue
            cur.execute(
                """
                SELECT id, sender, message_text, intent, sources_json, created_at
                FROM chat_messages
                WHERE session_id = ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (session["id"], remaining),
            )
            messages = rows_to_dicts(cur.fetchall())
            for message in messages:
                try:
                    message["sources"] = json.loads(message.pop("sources_json") or "[]")
                except json.JSONDecodeError:
                    message["sources"] = []
            session["messages"] = messages
            remaining -= len(messages)

        return sessions
    finally:
        conn.close()
