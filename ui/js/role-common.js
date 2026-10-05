const roleUser = requireHospitalLogin();

function logout() {
    clearHospitalSession();
    window.location.href = 'hospital-login.html';
}

function setupShell(defaultTitle) {
    const name = document.getElementById('user-name');
    if (name) name.textContent = roleUser.full_name;

    const hospital = roleUser.hospital_name || (roleUser.hospital_id ? `Hospital ID ${roleUser.hospital_id}` : 'Global');
    ['hospital-name', 'header-hospital'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = hospital;
    });

    const patientUid = document.getElementById('patient-uid');
    if (patientUid) patientUid.textContent = roleUser.patient_uid || 'Patient';

    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('theme-toggle')?.addEventListener('click', toggleHospitalTheme);

    document.querySelectorAll('aside button[data-view]').forEach((button) => {
        button.addEventListener('click', () => showView(button.dataset.view));
    });

    setTitle(defaultTitle);
}

function setTitle(title) {
    const el = document.getElementById('page-title');
    if (el) el.textContent = title;
}

function showView(view) {
    document.querySelectorAll('aside button[data-view]').forEach((button) => {
        button.classList.toggle('active', button.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach((section) => {
        section.classList.toggle('active', section.id === `view-${view}`);
    });
    setTitle(view.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
}

function item(title, subtitle = '') {
    return `<div class="item"><strong>${title}</strong>${subtitle ? `<span>${subtitle}</span>` : ''}</div>`;
}

function renderPatientList(containerId, patients) {
    const container = document.getElementById(containerId);
    if (!patients.length) {
        container.innerHTML = item('No patients found');
        return;
    }
    container.innerHTML = patients.map((patient) => `
        <div class="item">
            <strong>${patient.full_name}</strong>
            <span>ID ${patient.id} | ${patient.patient_uid} | Age ${patient.age ?? 'NA'} | ${patient.phone || 'No phone'}</span>
            <div class="row" style="margin-top:10px;">
                <button onclick="fillReportPatient(${patient.id})">New Report</button>
                <button onclick="fillInsightPatient(${patient.id})">Insights</button>
                ${document.getElementById('portal-patient-id') ? `<button onclick="fillPortalAccessPatient(${patient.id})">Portal Access</button>` : ''}
                ${document.getElementById('summary-patient-id') ? `<button onclick="fillSummaryPatient(${patient.id})">Give Summary</button>` : ''}
                ${document.getElementById('chat-patient-id') ? `<button onclick="fillChatPatient(${patient.id})">Chats</button>` : ''}
            </div>
        </div>
    `).join('');
}

function fillReportPatient(patientId) {
    const input = document.getElementById('report-patient-id');
    if (input) input.value = patientId;
    showView('reports');
}

function fillInsightPatient(patientId) {
    const input = document.getElementById('insight-patient-id');
    if (input) input.value = patientId;
    showView('insights');
    loadInsights?.();
}

function fillSummaryPatient(patientId) {
    const input = document.getElementById('summary-patient-id');
    if (input) input.value = patientId;
    showView('summary');
    document.getElementById('summary-text')?.focus();
}

function fillPortalAccessPatient(patientId) {
    const input = document.getElementById('portal-patient-id');
    if (input) input.value = patientId;
    showView('portal-access');
    loadPortalAccess?.();
}

function fillChatPatient(patientId) {
    const input = document.getElementById('chat-patient-id');
    if (input) input.value = patientId;
    showView('chats');
    loadPatientChats();
}

async function registerPatient(event) {
    event.preventDefault();
    const msg = document.getElementById('patient-message');
    msg.textContent = 'Registering patient...';

    try {
        const result = await hospitalApi('/api/patients/register', {
            method: 'POST',
            body: JSON.stringify({
                full_name: document.getElementById('patient-name').value,
                date_of_birth: document.getElementById('patient-dob').value || null,
                gender: document.getElementById('patient-gender').value,
                phone: document.getElementById('patient-phone').value,
                preferred_language: document.getElementById('patient-language').value,
                address: document.getElementById('patient-address').value,
            }),
        });

        if (result.reason === 'possible_duplicate') {
            msg.textContent = 'Possible duplicate found. Select existing patient or use a different record.';
            renderPatientList('patient-results', result.possible_duplicates);
            return;
        }

        const account = result.patient_account;
        if (account) {
            msg.innerHTML = `
                Patient registered: <strong>${result.patient_uid}</strong><br>
                Patient login username: <strong>${account.username}</strong><br>
                Temporary password: <strong>${account.temporary_password}</strong><br>
                Share these credentials with the patient. The password is shown only now.
            `;
        } else {
            msg.textContent = `Patient registered: ${result.patient_uid}`;
        }

        if (result.patient_account_error) {
            msg.innerHTML += `<br>Patient account warning: ${result.patient_account_error}`;
        }

        document.getElementById('patient-form').reset();
        await loadOverview?.();
    } catch (error) {
        msg.textContent = error.message;
    }
}

async function searchPatients() {
    const query = document.getElementById('patient-search').value.trim();
    if (!query) return;
    const patients = await hospitalApi(`/api/patients/search?q=${encodeURIComponent(query)}`);
    renderPatientList('patient-results', patients);
}

async function loadRegisteredPatients() {
    const patients = await hospitalApi('/api/patients?limit=100');
    renderPatientList('patient-results', patients);
}

function renderReportForm() {
    const form = document.getElementById('report-form');
    if (!form) return;

    form.innerHTML = `
        <label>Patient ID<input id="report-patient-id" type="number" min="1" required></label>
        <label>Report Type<select id="report-type"><option value="diabetes">Diabetes Report</option><option value="heart_simple">Simple Heart Screening</option></select></label>
        <label>Visit Reason<input id="report-reason" value="AI screening"></label>

        <div class="report-title">Diabetes Values</div>
        <label>Patient Gender<select id="diabetes-gender"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
        <label id="pregnancy-field">Pregnancies<input id="diabetes-pregnancies" type="number" step="1" value="0"></label>
        <label>Glucose<input id="diabetes-glucose" type="number" step="0.1"></label>
        <label>Blood Pressure (mmHg)<input id="diabetes-bp" type="text" inputmode="numeric" placeholder="Example: 120/80"><span>Systolic/diastolic as shown on the report</span></label>
        <label>Skin Thickness<input id="diabetes-skin" type="number" step="0.1"></label>
        <label>Insulin Level<input id="diabetes-insulin" type="number" step="0.1"></label>
        <label>BMI<input id="diabetes-bmi" type="number" step="0.1"></label>
        <label>Family History Score<input id="diabetes-dpf" type="number" step="0.01"></label>

        <div class="report-title">Simple Heart Screening</div>
        <label>Age<input id="heart-age" type="number" step="1"></label>
        <label>Gender<select id="heart-gender"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
        ${yesNo('heart-chest-pain', 'Chest Pain?')}
        ${yesNo('heart-breathless', 'Breathless While Walking?')}
        ${yesNo('heart-high-bp', 'High BP?')}
        ${yesNo('heart-diabetes', 'Diabetes?')}
        ${yesNo('heart-smoking', 'Smoking?')}
        ${yesNo('heart-cholesterol', 'High Cholesterol?')}
        ${yesNo('heart-tired', 'Tired Easily?')}
        ${yesNo('heart-family', 'Family History?')}
        ${yesNo('heart-recovery', 'Poor Exercise Recovery?')}
        ${yesNo('heart-exercise-pain', 'Chest Pain During Exercise?')}
        <button type="submit">Analyze & Save</button>
    `;

    document.getElementById('diabetes-gender').addEventListener('change', syncPregnancyField);
    syncPregnancyField();
    form.addEventListener('submit', submitReport);
}

function yesNo(id, label) {
    return `<label>${label}<select id="${id}"><option value="0">No</option><option value="1">Yes</option></select></label>`;
}

function renderStandalonePredictionForm() {
    const form = document.getElementById('standalone-prediction-form');
    if (!form) return;

    form.innerHTML = `
        <label>Patient ID
            <input id="quick-patient-id" type="number" min="1" step="1" required placeholder="Registered patient ID">
        </label>
        <button id="quick-load-patient-btn" type="button">Load Patient</button>
        <div id="quick-patient-preview" class="list"></div>
        <label>Prediction Type
            <select id="quick-prediction-type">
                <option value="diabetes">Diabetes Risk</option>
                <option value="heart">Advanced Heart Disease Risk</option>
            </select>
        </label>

        <div id="quick-diabetes-fields" style="display:contents;">
            <div class="report-title">Diabetes Report Values</div>
            <label>Gender<select id="quick-diabetes-gender"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
            <label id="quick-pregnancy-field">Pregnancies<input id="quick-diabetes-pregnancies" type="number" step="1" value="0"></label>
            <label>Age<input id="quick-diabetes-age" type="number" step="1" readonly required><span>Loaded from patient date of birth</span></label>
            <label>Glucose<input id="quick-diabetes-glucose" type="number" step="0.1" required></label>
            <label>Blood Pressure (mmHg)<input id="quick-diabetes-bp" type="text" inputmode="numeric" required placeholder="Example: 120/80"><span>Systolic/diastolic as shown on the report</span></label>
            <label>Skin Thickness<input id="quick-diabetes-skin" type="number" step="0.1" required></label>
            <label>Insulin<input id="quick-diabetes-insulin" type="number" step="0.1" required></label>
            <label>BMI<input id="quick-diabetes-bmi" type="number" step="0.1" required></label>
            <label>Family History Score<input id="quick-diabetes-dpf" type="number" step="0.01" value="0.3" required></label>
        </div>

        <div id="quick-heart-fields" style="display:none;">
            <div class="report-title">Advanced Heart Report Values</div>
            <label>Age<input id="quick-heart-age" type="number" min="1" step="1" readonly required><span>Loaded from patient date of birth</span></label>
            <label>Sex<select id="quick-heart-sex"><option value="1">Male</option><option value="0">Female</option></select></label>
            <label>Chest Pain Type<select id="quick-heart-cp"><option value="asymptomatic">Asymptomatic</option><option value="typical angina">Typical angina</option><option value="atypical angina">Atypical angina</option><option value="non-anginal">Non-anginal pain</option></select></label>
            <label>Resting Blood Pressure (mmHg)<input id="quick-heart-bp" type="text" inputmode="numeric" required placeholder="Example: 120/80"><span>Systolic/diastolic as shown on the report</span></label>
            <label>Total Cholesterol (mg/dL)<input id="quick-heart-chol" type="number" min="1" step="0.1" required></label>
            <label>Fasting Blood Sugar above 120 mg/dL?<select id="quick-heart-fbs"><option value="0">No</option><option value="1">Yes</option></select></label>
            <label>Maximum Heart Rate<input id="quick-heart-thalch" type="number" min="1" step="0.1" required></label>
            <label>Exercise-Induced Chest Pain?<select id="quick-heart-exang"><option value="0">No</option><option value="1">Yes</option></select></label>
            <label>ST Depression<input id="quick-heart-oldpeak" type="number" min="0" step="0.1" required></label>
            <label>Major Vessels (0-3)<input id="quick-heart-ca" type="number" min="0" max="3" step="1" required></label>
            <label>Resting ECG<select id="quick-heart-restecg"><option value="normal">Normal</option><option value="lv hypertrophy">Left ventricular hypertrophy</option><option value="st-t abnormality">ST-T abnormality</option></select></label>
            <label>ST Slope<select id="quick-heart-slope"><option value="upsloping">Upsloping</option><option value="flat">Flat</option><option value="downsloping">Downsloping</option></select></label>
            <label>Thal Result<select id="quick-heart-thal"><option value="normal">Normal</option><option value="fixed defect">Fixed defect</option><option value="reversable defect">Reversible defect</option></select></label>
        </div>
        <button type="submit">Analyze</button>
    `;

    document.getElementById('quick-diabetes-gender').addEventListener('change', syncQuickPregnancyField);
    document.getElementById('quick-prediction-type').addEventListener('change', syncQuickPredictionFields);
    document.getElementById('quick-load-patient-btn').addEventListener('click', () => {
        loadQuickPredictionPatient().catch(() => {});
    });
    syncQuickPregnancyField();
    syncQuickPredictionFields();
    form.addEventListener('submit', submitStandalonePrediction);
}

async function loadQuickPredictionPatient() {
    const patientId = numberValue('quick-patient-id');
    const preview = document.getElementById('quick-patient-preview');
    const msg = document.getElementById('standalone-prediction-message');

    if (!Number.isInteger(patientId) || patientId < 1) {
        throw new Error('Enter a valid registered patient ID.');
    }

    if (preview) preview.innerHTML = item('Loading patient...');
    if (msg) msg.textContent = '';

    try {
        const patient = await hospitalApi(`/api/patients/${patientId}`);
        if (patient.age == null) {
            throw new Error('This patient has no date of birth. Update the patient registration before prediction.');
        }

        document.getElementById('quick-diabetes-age').value = patient.age;
        document.getElementById('quick-heart-age').value = patient.age;

        if (['male', 'female', 'other'].includes(patient.gender)) {
            document.getElementById('quick-diabetes-gender').value = patient.gender;
            syncQuickPregnancyField();
        }
        if (patient.gender === 'male' || patient.gender === 'female') {
            document.getElementById('quick-heart-sex').value = patient.gender === 'male' ? '1' : '0';
        }

        if (preview) {
            preview.innerHTML = item(
                escapeRoleHtml(patient.full_name),
                `${escapeRoleHtml(patient.patient_uid)} | Age ${patient.age} | ${escapeRoleHtml(patient.gender)}`
            );
        }
        return patient;
    } catch (error) {
        if (preview) preview.innerHTML = item('Could not load patient', escapeRoleHtml(error.message));
        if (msg) msg.textContent = error.message;
        throw error;
    }
}

function syncQuickPredictionFields() {
    const type = document.getElementById('quick-prediction-type')?.value;
    const diabetesFields = document.getElementById('quick-diabetes-fields');
    const heartFields = document.getElementById('quick-heart-fields');
    if (!diabetesFields || !heartFields) return;
    diabetesFields.style.display = type === 'diabetes' ? 'contents' : 'none';
    heartFields.style.display = type === 'heart' ? 'contents' : 'none';
    diabetesFields.querySelectorAll('input').forEach((input) => { input.disabled = type !== 'diabetes'; });
    heartFields.querySelectorAll('input').forEach((input) => { input.disabled = type !== 'heart'; });
}

function syncQuickPregnancyField() {
    const gender = document.getElementById('quick-diabetes-gender')?.value;
    const field = document.getElementById('quick-pregnancy-field');
    const input = document.getElementById('quick-diabetes-pregnancies');
    if (!field || !input) return;
    field.style.display = gender === 'female' ? 'grid' : 'none';
    if (gender !== 'female') input.value = '0';
}

async function submitStandalonePrediction(event) {
    event.preventDefault();
    const type = document.getElementById('quick-prediction-type').value;
    const patientId = numberValue('quick-patient-id');
    const msg = document.getElementById('standalone-prediction-message');
    const output = document.getElementById('standalone-prediction-output');
    msg.textContent = 'Checking patient and running prediction...';
    output.innerHTML = '';

    let endpoint = '/predict/diabetes';
    let payload;
    let patient;

    try {
        if (!Number.isInteger(patientId) || patientId < 1) {
            throw new Error('Enter a valid registered patient ID.');
        }
        patient = await loadQuickPredictionPatient();

        if (type === 'diabetes') {
            const bloodPressure = parseBloodPressure('quick-diabetes-bp');
            payload = {
                Pregnancies: numberValue('quick-diabetes-pregnancies') || 0,
                Glucose: numberValue('quick-diabetes-glucose'),
                BloodPressure: bloodPressure.diastolic,
                SkinThickness: numberValue('quick-diabetes-skin'),
                Insulin: numberValue('quick-diabetes-insulin'),
                BMI: numberValue('quick-diabetes-bmi'),
                DiabetesPedigreeFunction: numberValue('quick-diabetes-dpf'),
                Age: numberValue('quick-diabetes-age'),
            };
        } else {
            const bloodPressure = parseBloodPressure('quick-heart-bp');
            const cp = document.getElementById('quick-heart-cp').value;
            const restecg = document.getElementById('quick-heart-restecg').value;
            const slope = document.getElementById('quick-heart-slope').value;
            const thal = document.getElementById('quick-heart-thal').value;
            endpoint = '/predict/heart';
            payload = {
                age: numberValue('quick-heart-age'),
                sex: intValue('quick-heart-sex'),
                trestbps: bloodPressure.systolic,
                chol: numberValue('quick-heart-chol'),
                fbs: intValue('quick-heart-fbs'),
                thalch: numberValue('quick-heart-thalch'),
                exang: intValue('quick-heart-exang'),
                oldpeak: numberValue('quick-heart-oldpeak'),
                ca: numberValue('quick-heart-ca'),
                'cp_asymptomatic': cp === 'asymptomatic' ? 1 : 0,
                'cp_atypical angina': cp === 'atypical angina' ? 1 : 0,
                'cp_non-anginal': cp === 'non-anginal' ? 1 : 0,
                'cp_typical angina': cp === 'typical angina' ? 1 : 0,
                'restecg_lv hypertrophy': restecg === 'lv hypertrophy' ? 1 : 0,
                'restecg_normal': restecg === 'normal' ? 1 : 0,
                'restecg_st-t abnormality': restecg === 'st-t abnormality' ? 1 : 0,
                'slope_downsloping': slope === 'downsloping' ? 1 : 0,
                'slope_flat': slope === 'flat' ? 1 : 0,
                'slope_upsloping': slope === 'upsloping' ? 1 : 0,
                'thal_fixed defect': thal === 'fixed defect' ? 1 : 0,
                'thal_normal': thal === 'normal' ? 1 : 0,
                'thal_reversable defect': thal === 'reversable defect' ? 1 : 0,
                ecg_result: restecg,
                thalassemia: thal,
            };
        }

        const visit = await hospitalApi('/api/visits/create', {
            method: 'POST',
            body: JSON.stringify({
                patient_id: patientId,
                visit_reason: type === 'diabetes'
                    ? 'Quick diabetes risk prediction'
                    : 'Quick advanced heart disease prediction',
                visit_status: 'completed',
            }),
        });

        const saved = type === 'diabetes'
            ? await hospitalApi('/api/reports/diabetes', {
                method: 'POST',
                body: JSON.stringify({
                    visit_id: visit.id,
                    input_values: payload,
                }),
            })
            : await hospitalApi('/api/reports/heart', {
                method: 'POST',
                body: JSON.stringify({
                    visit_id: visit.id,
                    mode: 'advanced_medical',
                    input_values: payload,
                }),
            });

        const result = saved.prediction;

        msg.textContent = `Prediction saved to patient insights (visit ${visit.id}).`;
        output.innerHTML = `
            ${item(escapeRoleHtml(patient.full_name), `${escapeRoleHtml(patient.patient_uid)} | Patient ID ${patient.id}`)}
            ${renderStandalonePredictionResult(result)}
        `;
    } catch (error) {
        msg.textContent = error.message;
    }
}

function renderStandalonePredictionResult(result) {
    const explanation = result.explanation || {};
    const factors = explanation.top_factors || result.top_factors || [];
    const nextSteps = explanation.next_steps || result.next_steps || [];
    const title = result.result || result.type || 'Prediction Complete';
    const risk = result.risk || result.type_risk || 'NA';
    const confidence = result.confidence != null ? `${result.confidence}%` : 'NA';
    const isHeart = result.mode === 'simple_heart_screening' || title.toLowerCase().includes('heart');
    const reportTitle = isHeart ? 'Heart Disease Report' : 'Diabetes Risk Report';
    const icon = isHeart ? '❤️' : '🩸';
    const riskClass = String(risk).toLowerCase().includes('high') || String(risk).toLowerCase().includes('very')
        ? 'danger'
        : String(risk).toLowerCase().includes('moderate')
            ? 'warning'
            : 'success';
    const clinicalText = explanation.clinical_interpretation || result.description || '';

    return `
        <div class="prediction-report ${riskClass}">
            <div class="prediction-complete">MediRisk Analysis Complete ✅</div>
            <div class="prediction-card">
                <div class="prediction-card-head">
                    <h3>${icon} ${reportTitle}</h3>
                    <span class="risk-pill ${riskClass}">${risk} Risk</span>
                </div>
                <div class="prediction-rows">
                    <div><span>Result</span><strong>${title}</strong></div>
                    <div><span>Confidence</span><strong>${confidence}</strong></div>
                    ${result.score != null ? `<div><span>Score</span><strong>${result.score}</strong></div>` : ''}
                    ${result.description ? `<div><span>What it means</span><strong>${result.description}</strong></div>` : ''}
                    ${result.action ? `<div><span>Action Required</span><strong>${result.action}</strong></div>` : ''}
                    ${result.diet ? `<div><span>Diet Advice</span><strong>${result.diet}</strong></div>` : ''}
                    ${result.exercise ? `<div><span>Exercise</span><strong>${result.exercise}</strong></div>` : ''}
                </div>
                ${explanation.plain_explanation ? `
                    <section class="prediction-section">
                        <h4>Why this result?</h4>
                        <p>${explanation.plain_explanation}</p>
                    </section>
                ` : ''}
                ${clinicalText ? `
                    <section class="prediction-section">
                        <h4>Clinical interpretation</h4>
                        <p>${clinicalText}</p>
                    </section>
                ` : ''}
                ${factors.length ? `
                    <section class="prediction-section">
                        <h4>Top contributing factors</h4>
                        <div class="factor-list">
                            ${factors.slice(0, 6).map((factor) => `
                                <div class="factor-row">
                                    <strong>${factor.name || factor}</strong>
                                    ${factor.status ? `<span>${factor.status}</span>` : factor.points != null ? `<span>${factor.points} point(s)</span>` : ''}
                                    <p>${factor.explanation || ''}</p>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}
                ${nextSteps.length ? `
                    <section class="prediction-section">
                        <h4>Recommended next steps</h4>
                        <ul>${nextSteps.slice(0, 5).map((step) => `<li>${step}</li>`).join('')}</ul>
                    </section>
                ` : ''}
                <div class="prediction-note">⚠️ This is AI screening guidance, not a diagnosis. Please consult a qualified doctor.</div>
            </div>
        </div>
    `;
}

function syncPregnancyField() {
    const gender = document.getElementById('diabetes-gender')?.value;
    const field = document.getElementById('pregnancy-field');
    const input = document.getElementById('diabetes-pregnancies');
    if (!field || !input) return;
    field.style.display = gender === 'female' ? 'grid' : 'none';
    if (gender !== 'female') input.value = '0';
}

function numberValue(id) {
    const value = document.getElementById(id)?.value;
    return value === '' || value == null ? null : Number(value);
}

function parseBloodPressure(id) {
    const raw = document.getElementById(id)?.value.trim() || '';
    const match = raw.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (!match) {
        throw new Error('Enter blood pressure in systolic/diastolic format, for example 120/80.');
    }

    const systolic = Number(match[1]);
    const diastolic = Number(match[2]);
    if (systolic < 70 || systolic > 250 || diastolic < 40 || diastolic > 150) {
        throw new Error('Blood pressure is outside the supported range. Please check the report value.');
    }
    if (systolic <= diastolic) {
        throw new Error('Systolic pressure must be higher than diastolic pressure.');
    }
    return { systolic, diastolic };
}

function intValue(id) {
    return Number(document.getElementById(id)?.value || 0);
}

async function submitReport(event) {
    event.preventDefault();
    const msg = document.getElementById('report-message');
    msg.textContent = 'Saving report...';
    const patientId = Number(document.getElementById('report-patient-id').value);
    const reportType = document.getElementById('report-type').value;

    try {
        const bloodPressure = reportType === 'diabetes'
            ? parseBloodPressure('diabetes-bp')
            : null;
        const visit = await hospitalApi('/api/visits/create', {
            method: 'POST',
            body: JSON.stringify({
                patient_id: patientId,
                visit_reason: document.getElementById('report-reason').value || 'AI screening',
                visit_status: 'completed',
            }),
        });

        let endpoint = '/api/reports/diabetes';
        let body = {
            visit_id: visit.id,
            input_values: {
                Pregnancies: numberValue('diabetes-pregnancies') || 0,
                Glucose: numberValue('diabetes-glucose'),
                BloodPressure: bloodPressure?.diastolic,
                SkinThickness: numberValue('diabetes-skin'),
                Insulin: numberValue('diabetes-insulin'),
                BMI: numberValue('diabetes-bmi'),
                DiabetesPedigreeFunction: numberValue('diabetes-dpf') || 0,
            },
        };

        if (reportType === 'heart_simple') {
            endpoint = '/api/reports/heart';
            body = {
                visit_id: visit.id,
                mode: 'simple_screening',
                input_values: {
                    age: numberValue('heart-age'),
                    gender: document.getElementById('heart-gender').value,
                    chest_pain: intValue('heart-chest-pain'),
                    breathless_walking: intValue('heart-breathless'),
                    high_bp: intValue('heart-high-bp'),
                    diabetes: intValue('heart-diabetes'),
                    smoking: intValue('heart-smoking'),
                    high_cholesterol: intValue('heart-cholesterol'),
                    tired_easily: intValue('heart-tired'),
                    family_history: intValue('heart-family'),
                    poor_exercise_recovery: intValue('heart-recovery'),
                    exercise_chest_pain: intValue('heart-exercise-pain'),
                },
            };
        }

        const saved = await hospitalApi(endpoint, { method: 'POST', body: JSON.stringify(body) });
        msg.textContent = `Report saved for visit ${visit.id}`;
        document.getElementById('report-output').innerHTML = item(
            saved.prediction.result || saved.report.risk_level || 'Report saved',
            `Risk: ${saved.prediction.risk || saved.report.risk_level || 'NA'}`
        );
    } catch (error) {
        msg.textContent = error.message;
    }
}

async function loadInsights() {
    const patientId = document.getElementById('insight-patient-id').value;
    if (!patientId) return;
    const [patient, insights, doctorSummaries] = await Promise.all([
        hospitalApi(`/api/patients/${patientId}`),
        hospitalApi(`/api/patients/${patientId}/insights`),
        hospitalApi(`/api/patients/${patientId}/doctor-summaries`),
    ]);
    const doctorWrittenSummary = doctorSummaries.length
        ? doctorSummaries.map((summary) => `
            <div class="item">
                <strong>${summary.doctor_name || 'Doctor'} - ${summary.created_at || ''}</strong>
                <ul>
                    <li>${summary.summary_text}</li>
                    ${summary.medication_suggestions ? `<li><strong>Medication:</strong> ${summary.medication_suggestions}</li>` : ''}
                    ${summary.lifestyle_suggestions ? `<li><strong>Lifestyle:</strong> ${summary.lifestyle_suggestions}</li>` : ''}
                    ${summary.follow_up_advice ? `<li><strong>Follow-up:</strong> ${summary.follow_up_advice}</li>` : ''}
                </ul>
            </div>
        `).join('')
        : item('No doctor-written summary found', 'A doctor has not shared a patient-facing summary yet.');

    document.getElementById('insight-output').innerHTML = `
        ${item(patient.full_name, `${patient.patient_uid} | Age ${patient.age ?? 'NA'} | ${patient.gender}`)}
        <div class="item"><strong>AI Report Summary</strong><ul>${insights.doctor_summary.map((x) => `<li>${x}</li>`).join('')}</ul></div>
        <div class="item"><strong>Doctor-Written Patient Summary</strong></div>
        ${doctorWrittenSummary}
        <div class="item"><strong>Recommendations</strong><ul>${insights.recommendations.map((x) => `<li>${x}</li>`).join('')}</ul></div>
        <button class="no-print" onclick="printPatientInsights()">Print Report</button>
    `;
}

function printPatientInsights() {
    document.body.classList.add('printing-insights');
    window.print();
    window.setTimeout(() => {
        document.body.classList.remove('printing-insights');
    }, 300);
}

async function loadPortalAccess() {
    const patientId = document.getElementById('portal-patient-id')?.value;
    const output = document.getElementById('portal-access-output');
    if (!patientId || !output) return;

    output.innerHTML = item('Loading portal access...');

    try {
        const data = await hospitalApi(`/api/patients/${patientId}/portal-access`);
        const patient = data.patient;
        const account = data.account;

        if (!account) {
            output.innerHTML = `
                ${item(patient.full_name, `${patient.patient_uid} | Patient ID ${patient.id}`)}
                ${item('No patient portal account found', 'Registering new patients now creates access automatically. Add account generation for old patients next.')}
            `;
            return;
        }

        output.innerHTML = `
            ${item(patient.full_name, `${patient.patient_uid} | Patient ID ${patient.id}`)}
            <div class="item">
                <strong>Patient Username</strong>
                <span>${account.username}</span>
            </div>
            <div class="item">
                <strong>Password</strong>
                <span>Hidden for security. Click reset to generate a new temporary password.</span>
            </div>
            <div class="item">
                <strong>Account Status</strong>
                <span>${account.is_active ? 'Active' : 'Inactive'} | Created ${account.created_at || 'NA'}</span>
            </div>
            <button onclick="resetPortalPassword()">Reset Temporary Password</button>
        `;
    } catch (error) {
        output.innerHTML = item('Could not load portal access', error.message);
    }
}

async function resetPortalPassword() {
    const patientId = document.getElementById('portal-patient-id')?.value;
    const output = document.getElementById('portal-access-output');
    if (!patientId || !output) return;

    try {
        const data = await hospitalApi(`/api/patients/${patientId}/portal-access/reset-password`, {
            method: 'POST',
            body: JSON.stringify({}),
        });

        output.innerHTML += `
            <div class="item">
                <strong>New Temporary Password</strong>
                <span>${data.temporary_password}</span>
                <span>Show this to the patient now. It will not be visible again.</span>
            </div>
        `;
    } catch (error) {
        output.innerHTML += item('Could not reset password', error.message);
    }
}

function escapeRoleHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function loadPatientChats() {
    const patientId = document.getElementById('chat-patient-id')?.value;
    const output = document.getElementById('chat-history-output');
    if (!patientId || !output) return;

    output.innerHTML = item('Loading chat history...');

    try {
        const data = await hospitalApi(`/api/patients/${patientId}/chats`);
        const sessions = data.sessions || [];
        if (!sessions.length) {
            output.innerHTML = `
                ${item(escapeRoleHtml(data.patient.full_name), escapeRoleHtml(data.patient.patient_uid))}
                ${item('No saved chatbot conversations', 'This patient has not used the chatbot yet.')}
            `;
            return;
        }

        output.innerHTML = `
            ${item(escapeRoleHtml(data.patient.full_name), `${escapeRoleHtml(data.patient.patient_uid)} | ${sessions.length} conversation(s)`)}
            ${sessions.map((session) => `
                <div class="item chat-session-readonly">
                    <strong>Conversation - ${escapeRoleHtml(session.created_at)}</strong>
                    <span>${escapeRoleHtml(session.language.toUpperCase())} | Read only</span>
                    <div class="chat-history-messages">
                        ${(session.messages || []).map((message) => `
                            <div class="chat-history-message ${message.sender}">
                                <strong>${message.sender === 'user' ? 'Patient' : 'MediRisk AI'}</strong>
                                <p>${escapeRoleHtml(message.message_text).replaceAll('\n', '<br>')}</p>
                                <small>${escapeRoleHtml(message.created_at)}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        `;
    } catch (error) {
        output.innerHTML = item('Could not load patient chats', escapeRoleHtml(error.message));
    }
}

document.getElementById('load-chats-btn')?.addEventListener('click', loadPatientChats);
