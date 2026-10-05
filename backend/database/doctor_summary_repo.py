from .connection import get_connection, now_iso, row_to_dict, rows_to_dicts


def ensure_doctor_summaries_table():
    conn = get_connection()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS patient_doctor_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            doctor_user_id INTEGER NOT NULL,
            hospital_id INTEGER,
            summary_text TEXT NOT NULL,
            medication_suggestions TEXT,
            lifestyle_suggestions TEXT,
            follow_up_advice TEXT,
            is_visible_to_patient INTEGER NOT NULL DEFAULT 1 CHECK (is_visible_to_patient IN (0, 1)),
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (patient_id)
                REFERENCES patients(id)
                ON DELETE CASCADE,
            FOREIGN KEY (doctor_user_id)
                REFERENCES users(id)
                ON DELETE CASCADE,
            FOREIGN KEY (hospital_id)
                REFERENCES hospitals(id)
                ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_patient_doctor_summaries_patient_id
            ON patient_doctor_summaries(patient_id, created_at);

        CREATE INDEX IF NOT EXISTS idx_patient_doctor_summaries_doctor_id
            ON patient_doctor_summaries(doctor_user_id);
        """
    )

    cur.execute("PRAGMA table_info(patient_doctor_summaries)")
    existing_columns = {row["name"] for row in cur.fetchall()}

    if "hospital_id" not in existing_columns:
        cur.execute("ALTER TABLE patient_doctor_summaries ADD COLUMN hospital_id INTEGER")
        cur.execute(
            """
            UPDATE patient_doctor_summaries
            SET hospital_id = (
                SELECT u.hospital_id
                FROM patients p
                LEFT JOIN users u ON u.id = p.registered_by_user_id
                WHERE p.id = patient_doctor_summaries.patient_id
            )
            WHERE hospital_id IS NULL
            """
        )

    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_patient_doctor_summaries_hospital_id
            ON patient_doctor_summaries(hospital_id, patient_id, created_at)
        """
    )

    conn.commit()
    conn.close()


def create_patient_doctor_summary(
    patient_id,
    doctor_user_id,
    hospital_id,
    summary_text,
    medication_suggestions=None,
    lifestyle_suggestions=None,
    follow_up_advice=None,
    is_visible_to_patient=True,
):
    if not summary_text or not summary_text.strip():
        raise ValueError("Patient summary is required")

    ensure_doctor_summaries_table()
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO patient_doctor_summaries (
            patient_id,
            doctor_user_id,
            hospital_id,
            summary_text,
            medication_suggestions,
            lifestyle_suggestions,
            follow_up_advice,
            is_visible_to_patient,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            patient_id,
            doctor_user_id,
            hospital_id,
            summary_text.strip(),
            medication_suggestions.strip() if medication_suggestions else None,
            lifestyle_suggestions.strip() if lifestyle_suggestions else None,
            follow_up_advice.strip() if follow_up_advice else None,
            1 if is_visible_to_patient else 0,
            now_iso(),
        ),
    )
    summary_id = cur.lastrowid
    conn.commit()

    cur.execute(
        """
        SELECT
            s.*,
            u.full_name AS doctor_name,
            h.name AS hospital_name
        FROM patient_doctor_summaries s
        JOIN users u ON u.id = s.doctor_user_id
        LEFT JOIN hospitals h ON h.id = s.hospital_id
        WHERE s.id = ?
        """,
        (summary_id,),
    )
    summary = row_to_dict(cur.fetchone())
    conn.close()
    return summary


def list_patient_doctor_summaries(
    patient_id,
    visible_only=True,
    hospital_id=None,
    limit=20,
    offset=0,
):
    ensure_doctor_summaries_table()
    conn = get_connection()
    cur = conn.cursor()

    filters = ["s.patient_id = ?"]
    params = [patient_id]

    if visible_only:
        filters.append("s.is_visible_to_patient = 1")

    if hospital_id is not None:
        filters.append("s.hospital_id = ?")
        params.append(hospital_id)

    params.extend([limit, offset])

    cur.execute(
        f"""
        SELECT
            s.*,
            u.full_name AS doctor_name,
            h.name AS hospital_name
        FROM patient_doctor_summaries s
        JOIN users u ON u.id = s.doctor_user_id
        LEFT JOIN hospitals h ON h.id = s.hospital_id
        WHERE {" AND ".join(filters)}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
        """,
        params,
    )
    summaries = rows_to_dicts(cur.fetchall())
    conn.close()
    return summaries
