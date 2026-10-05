# MediRisk

### Disease risk screening, patient records, and multilingual health guidance

MediRisk is an AI-assisted healthcare demo that brings diabetes and heart disease risk screening into a hospital-style workflow. Staff can register patients, record visits, enter report values, view model-generated explanations, and share doctor-written summaries. Patients can view their own information and ask a chatbot questions using the context of their stored reports.

The project connects machine learning, medical knowledge retrieval, and patient record management through a Flask backend and a browser-based interface. It is intended for academic demonstrations and local development.

## The problem it addresses

A disease prediction model is only one part of a useful healthcare application. People also need explanations, a history of their results, access to their doctor's guidance, and information in a language they understand. Staff need a way to connect those results to the right patient and visit.

MediRisk addresses these gaps in a single prototype:

| Workflow problem | What MediRisk implements |
| --- | --- |
| Prediction results are difficult to interpret | Risk categories, model confidence, contributing factors, and explanatory result cards |
| Screening results are disconnected from patient records | Patient registration, visits, stored diabetes/heart reports, and report history |
| Changes across visits are hard to follow | Comparisons of current and previous report values and risk categories |
| Patients need access to their doctor's explanation | A patient portal showing doctor-written summaries and follow-up guidance |
| General chatbot answers lack patient context | A chatbot that receives the logged-in patient's stored report context |
| English-only interfaces limit access to health information | English, Hindi, and Telugu language handling with optional translation |
| Different hospital roles need different workspaces | Separate dashboards and role checks for staff, administrators, and patients |
| Hospital activity is difficult to inspect in one place | Dashboard summaries, risk distributions, trends, and audit activity |

The resulting demonstration follows a patient from registration through report entry, risk analysis, doctor summaries, and patient access. These are implemented workflow capabilities; clinical effectiveness and real-world health outcomes have not been established by this project.

## Main capabilities

### Risk screening and explanations

Saved XGBoost models provide binary diabetes risk prediction, experimental diabetes type classification, and heart disease risk prediction from structured inputs. A separate questionnaire-based heart screening flow works without a full laboratory report.

Prediction results include explanations and relevant input factors. Quick screening returns a result directly. The patient report workflow stores report values and prediction results against a visit so they can be reviewed later.

The experimental diabetes type classifier is a project feature and requires clinical confirmation. Model confidence is an output of the model, rather than a measure of certainty about a patient's diagnosis.

### Hospital and patient workflows

| Role | Main workspace |
| --- | --- |
| Super admin | Hospital/network overview, global analytics, audit activity, and patient portal access |
| Hospital admin | Hospital overview, patient registration, visits/reports, insights, and portal access |
| Receptionist | Patient registration/search, report entry, and quick screening |
| Doctor | Patient history, reports, risk explanations, and doctor-written summaries |
| Patient | Own summaries, guidance, and chatbot access |

Patient registration generates a portal username and temporary password. Authorized administrators can reset portal passwords. Password hashes are stored in SQLite, and staff and patient accounts use separate login checks.

### Chatbot with patient context

The chatbot uses retrieval-augmented generation (RAG): it retrieves relevant text from the local knowledge base and sends that text, the question, and patient context to OpenRouter to generate an answer. It also includes query processing, conversation memory, source references, and fallback responses.

English, Hindi, and Telugu are supported by the language-handling code. Full translation uses optional Google Cloud Translation credentials. Emergency-query guards and fixed responses are part of the chatbot response pipeline.

The `/chat` endpoint is available to logged-in patients. Staff can review patient information through their role-specific dashboards.

## How the system works

```text
Browser UI (HTML, CSS, JavaScript)
                 |
                 v
          Flask API :5001
                 |
       +---------+----------+----------------+
       |                    |                |
       v                    v                v
Hospital workflows     Risk screening    Patient chatbot
       |                    |                |
       v                    v                v
SQLite records         Saved ML models   Knowledge retrieval
Patients, visits,                        ChromaDB + embeddings
reports, summaries,                           |
chat history                                  v
                                         OpenRouter
                                         Optional translation
```

The backend loads AI components on demand. Hospital record operations do not require the chatbot to be initialized. Prediction requests need the local model files; chatbot requests need the knowledge index and an OpenRouter key.

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript; no Node.js build step |
| API | Flask and Flask-CORS |
| Records | SQLite and modular database repositories |
| Prediction | XGBoost, scikit-learn, pandas, NumPy |
| Retrieval | ChromaDB and `all-MiniLM-L6-v2` sentence-transformer embeddings |
| Response generation | OpenRouter |
| Translation | Optional Google Cloud Translation |
| Model development | Jupyter notebooks and local datasets |

## Project layout

```text
backend/
  app.py                  API entry point
  predict.py              Trained model loading and prediction
  heart_screening.py       Questionnaire-based heart screening
  explain.py              Prediction explanations
  rag.py                  Retrieval and chatbot responses
  index.py                Knowledge indexing script
  intent.py               Query processing
  language.py             Language detection and translation
  safety.py               Emergency-query guards
  database/               Schema and record repositories
  knowledge/              Local text sources and tracked examples
  prompts/                Chatbot prompt templates
ui/                       HTML pages, CSS, and JavaScript
notebooks/                Analysis and model development
scripts/                  Report generator and OpenRouter check
models/                   Local trained models and example guide
data/                     Local datasets and header-only examples
plots/                    Local analysis figures and example guide
docs/                     Local documents and example guide
config/private/           Local credentials and login-note templates
reports/                  Generated reports and example template
logs/                     Local backend logs
releases/                 Local release snapshots and bundles
storage/                  Legacy vector database backup
README.md                 Project overview and setup
requirements.txt          Pinned application dependencies
.env.example              Environment configuration template
.gitignore                Local-file and example-file rules
```

## What is included in a source checkout

Source code, notebooks, prompts, and safe `.example` templates are eligible for Git. Actual contents of `backend/knowledge/`, `data/`, `models/`, `plots/`, `docs/`, `config/private/`, and `reports/` are ignored. Direct `.example` files in those folders are retained as references.

| Example | Purpose |
| --- | --- |
| [.env.example](.env.example) | OpenRouter key and optional translation configuration |
| [Knowledge guide](backend/knowledge/README.md.example) and [chunk format](backend/knowledge/chunk.txt.example) | Required text filenames and parser format |
| [Dataset guide](data/README.md.example) and `data/*.csv.example` | Dataset filenames and column headers |
| [Model guide](models/README.md.example) | Required trained artifacts and development notebooks |
| [Private configuration guide](config/private/README.md.example) | Credential placement and local login notes |
| [Documentation guide](docs/README.md.example) | Local document and diagram layout |
| [Plot guide](plots/README.md.example) | Notebook figure locations |
| [Report template](reports/report.md.example) | Outline for a local report |

Examples contain placeholders or headers only. Supply real local assets before using the features that depend on them. Ignoring files preserves the existing local copies; `.gitignore` does not remove files already tracked by Git.

## Run locally

These commands use Windows PowerShell from the project root. The existing environment uses Python 3.13; use a Python version compatible with the pinned dependencies.

### 1. Install application dependencies

```powershell
py -3.13 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If activation is unavailable, use `.\venv\Scripts\python.exe` in place of `python`. Notebook experiments may need additional dependencies beyond the application requirements.

### 2. Supply local assets and environment settings

For predictions, place these compatible trained artifacts in `models/`:

- `diabetes_xgb_final.pkl`
- `diabetes2_xgb_model.pkl`
- `heart_xgb_model.pkl`

The prediction module loads all three on its first import. Restore them from your project backup or use the development notebooks with the necessary real datasets and dependencies. See the [model guide](models/README.md.example).

For the chatbot, restore the eight `.txt` files listed in the [knowledge guide](backend/knowledge/README.md.example). The example chunk only documents the format.

Create `.env` for a new setup:

```powershell
Copy-Item .env.example .env
```

If `.env` already exists, edit it instead of overwriting it. Set `OPENROUTER_API_KEY` to your own key.

For optional translation, obtain a real Google Cloud service account JSON file and place it at `config/private/google-translate-key.json`, or set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path. The JSON example cannot authenticate. The code also supports the previous root key location and configuration pointing to that moved file.

### 3. Initialize a fresh database and staff account

Keep an existing working `backend/medirisk.db`. For a fresh checkout, explicitly create the current tables:

```powershell
python -m backend.database.schema
```

Starting the API does not initialize the database automatically. The schema command creates tables but does not seed accounts. Use `backend/database/schema.py`; `backend/database/database.py` contains an older schema.

For a new, empty database, open Python with `python` and run:

```python
from getpass import getpass
from backend.database.hospital_repo import create_hospital
from backend.database.auth_repo import create_user

hospital_id = create_hospital(name="Demo Hospital", code="DEMO")
user_id = create_user(
    full_name="Demo Hospital Admin",
    username="demo_admin",
    password=getpass("Choose a local demo password: "),
    role="hospital_admin",
    hospital_id=hospital_id,
)
print("Created user:", user_id)
exit()
```

Run this example once: hospital codes and usernames must be unique. Passwords require at least eight characters with an uppercase letter, a lowercase letter, and a number. Use the same `create_user` function to create doctor or receptionist accounts for the hospital; a `super_admin` account does not require a hospital ID.

Patient accounts are generated during registration. Login-page demo buttons work only when their matching accounts and passwords exist in your local database.

### 4. Build the chatbot index

After restoring all required knowledge files:

```powershell
python backend\index.py
```

The script builds the `medirisk` collection in `backend/vectordb/`. The embedding model may download on first use. Rerun after updating knowledge text; the script deletes and rebuilds that collection. Files ending in `.example` are not indexed.

### 5. Start the backend and frontend

First terminal:

```powershell
python backend\app.py
```

Second terminal:

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory ui
```

Open [Hospital Login](http://127.0.0.1:8000/hospital-login.html). Sign in as staff to register a patient and create reports. Sign in with the generated patient account to view the patient portal and open the chatbot.

The backend runs at `http://127.0.0.1:5001`. Frontend API addresses are in `ui/js/hospital-api.js` and `ui/js/chatbot.js`; update both if the backend address changes.

## Suggested demo workflow

1. Sign in as a hospital admin or receptionist and register a patient.
2. Save the generated patient login details in your local private notes.
3. Create a visit and enter a diabetes or heart report through the staff workspace.
4. Review the stored result, explanations, and patient insights.
5. Sign in as a doctor and write a patient-facing summary.
6. Sign in as the patient, read the summary, and ask the chatbot a question using the stored report context.
7. Review hospital analytics from the relevant administrator dashboard.

## Key API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Backend availability |
| POST | `/api/auth/login` | Staff/patient login |
| POST | `/predict/diabetes` | Diabetes risk prediction |
| POST | `/predict/diabetes-type` | Experimental type classification |
| POST | `/predict/heart` | Heart disease risk prediction |
| POST | `/screen/heart-simple` | Questionnaire-based screening |
| POST | `/api/patients/register` | Patient registration and portal account |
| POST | `/api/visits/create` | Visit creation |
| POST | `/api/reports/diabetes` | Stored diabetes report |
| POST | `/api/reports/heart` | Stored heart report |
| GET | `/api/analytics/dashboard` | Dashboard summary |
| POST | `/chat` | Chatbot query for a logged-in patient |

See `backend/app.py` for request fields and additional routes. Protected routes use demo `X-User-Id` or `X-Patient-Account-Id` headers supplied by the frontend.

## Verification and troubleshooting

Check API availability with the backend running:

```powershell
Invoke-RestMethod http://127.0.0.1:5001/health
```

The health endpoint checks API availability. Verify database, model, and chatbot behavior through login, a prediction, and a patient chatbot request.

| Issue | Check |
| --- | --- |
| Missing database tables | Initialize a fresh database with `python -m backend.database.schema` |
| Missing model or feature mismatch | Restore compatible artifacts and use the pinned dependencies and expected inputs |
| Missing Chroma collection | Restore knowledge files, then run `python backend/index.py` |
| Missing OpenRouter key | Fill in `.env` and restart the backend |
| Chatbot access denied | Sign in with a patient account |
| Hindi/Telugu translation unavailable | Check the real Google Cloud credentials and translation setup |
| Frontend cannot reach the API | Confirm port `5001` and the frontend API addresses |

Back up existing databases before schema changes; the schema script is not a migration system. `python scripts/test_api.py` makes a real external OpenRouter request and is a connectivity helper rather than an application test suite.

For an optional Word handoff report, install `python-docx` and run `python scripts/build_demo_report.py`. It writes `reports/MediRisk_Demo_Handoff_Report.docx` and uses available local datasets, plots, and `docs/assets/block diagram-full architecture.png`.

## Current scope and limitations

MediRisk demonstrates an integrated application workflow. Its predictions and generated guidance require qualified clinical review, and this README does not claim independently verified model accuracy or clinical validation.

The current server uses Flask debug mode, enables CORS, and relies on client-supplied account ID headers for demo authentication. Production deployment requires proper session/token authentication, deployment configuration, migrations, and protection of patient data. Notebook training, dataset preparation, and provision of local model/knowledge assets are separate setup tasks.
