setupShell('Overview');

let hospitalSummaryById = new Map();

async function loadOverview() {
    const summary = await hospitalApi('/api/analytics/dashboard');
    document.getElementById('metrics').innerHTML = `
        <div class="metric"><span>Total Hospitals</span><strong>${summary.total_hospitals}</strong></div>
        <div class="metric"><span>Total Patients</span><strong>${summary.total_patients}</strong></div>
        <div class="metric"><span>Total Reports</span><strong>${summary.diabetes_reports + summary.heart_reports}</strong></div>
    `;
}

async function loadHospitals() {
    const hospitals = await hospitalApi('/api/analytics/hospitals');
    hospitalSummaryById = new Map(hospitals.map((hospital) => [hospital.hospital_id, hospital]));
    document.getElementById('hospital-list').innerHTML = hospitals.map((hospital) => `
        <button type="button" class="hospital-summary-button" onclick="loadHospitalInsights(${hospital.hospital_id})">
            <strong>${escapeRoleHtml(hospital.hospital_name)}</strong>
            <span>${escapeRoleHtml(hospital.city || 'City not available')} | Patients ${hospital.total_patients} | Reports ${hospital.diabetes_reports + hospital.heart_reports}</span>
            <span>Open hospital insights</span>
        </button>
    `).join('');
    document.getElementById('hospital-insight-panel').hidden = true;
}

function renderDistribution(rows) {
    if (!rows?.length) return item('No report data available');
    return rows.map((row) => item(
        escapeRoleHtml(row.risk_level || 'Unknown'),
        `${row.count} report(s)`
    )).join('');
}

async function loadHospitalInsights(hospitalId) {
    const hospital = hospitalSummaryById.get(hospitalId);
    const panel = document.getElementById('hospital-insight-panel');
    panel.hidden = false;
    document.getElementById('hospital-insight-title').textContent = hospital?.hospital_name || `Hospital ${hospitalId}`;
    document.getElementById('hospital-insight-metrics').innerHTML = item('Loading hospital insights...');

    try {
        const query = `?hospital_id=${encodeURIComponent(hospitalId)}`;
        const [summary, diabetesRisk, heartRisk, demographics, visitTrend, highRisk] = await Promise.all([
            hospitalApi(`/api/analytics/dashboard${query}`),
            hospitalApi(`/api/analytics/risk/diabetes${query}`),
            hospitalApi(`/api/analytics/risk/heart${query}`),
            hospitalApi(`/api/analytics/demographics${query}`),
            hospitalApi(`/api/analytics/visit-trend${query}`),
            hospitalApi(`/api/analytics/high-risk-patients${query}`),
        ]);

        document.getElementById('hospital-insight-metrics').innerHTML = `
            <div class="metric"><span>Registered Patients</span><strong>${summary.total_patients}</strong></div>
            <div class="metric"><span>Total Visits</span><strong>${summary.total_visits}</strong></div>
            <div class="metric"><span>Total Reports</span><strong>${summary.diabetes_reports + summary.heart_reports}</strong></div>
        `;
        document.getElementById('hospital-diabetes-risk').innerHTML = renderDistribution(diabetesRisk);
        document.getElementById('hospital-heart-risk').innerHTML = renderDistribution(heartRisk);

        const genders = demographics.gender_distribution || [];
        const ages = demographics.age_distribution || [];
        document.getElementById('hospital-demographics').innerHTML = [
            ...genders.map((row) => item(`Gender: ${escapeRoleHtml(row.gender || 'unknown')}`, `${row.count} patient(s)`)),
            ...ages.map((row) => item(`Age: ${escapeRoleHtml(row.age_group || 'unknown')}`, `${row.count} patient(s)`)),
        ].join('') || item('No demographic data available');

        document.getElementById('hospital-visit-trend').innerHTML = visitTrend?.length
            ? visitTrend.slice(-7).reverse().map((row) => item(escapeRoleHtml(row.period), `${row.visits} visit(s) | ${row.patients} patient(s)`)).join('')
            : item('No visit history available');

        document.getElementById('hospital-high-risk').innerHTML = highRisk?.length
            ? highRisk.map((patient) => item(
                escapeRoleHtml(patient.full_name),
                `${escapeRoleHtml(patient.patient_uid)} | Diabetes: ${escapeRoleHtml(patient.diabetes_risk || 'NA')} | Heart: ${escapeRoleHtml(patient.heart_risk || 'NA')}`
            )).join('')
            : item('No high-risk patients found');

        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        document.getElementById('hospital-insight-metrics').innerHTML = item('Could not load hospital insights', escapeRoleHtml(error.message));
    }
}

async function loadActivity() {
    const rows = await hospitalApi('/api/analytics/recent-activity');
    document.getElementById('activity-list').innerHTML = rows.map((x) =>
        item(x.action, `${x.entity_type} #${x.entity_id || ''} | ${x.created_at}`)
    ).join('');
}

document.querySelector('[data-view="hospitals"]').addEventListener('click', loadHospitals);
document.querySelector('[data-view="activity"]').addEventListener('click', loadActivity);
document.getElementById('load-insights-btn')?.addEventListener('click', loadInsights);
document.getElementById('load-portal-btn')?.addEventListener('click', loadPortalAccess);
loadOverview();
