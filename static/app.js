// ============================================================================
// BI AI AGENT — FRONTEND CONTROLLER (4-STEP HUMAN-IN-THE-LOOP WORKFLOW)
// ============================================================================

if (window.ChartDataLabels) {
  Chart.register(window.ChartDataLabels);
}

const AppState = {
  currentStep: 1,
  maxUnlockedStep: 1,
  normalizedCsv: "",
  step1Data: null,
  step2Data: null,
  step3Data: null,
  charts: {
    aging: null,
    workingCapital: null,
    pnl: null
  }
};

// Initialize clean workspace on page load
window.addEventListener("DOMContentLoaded", () => {
  resetWorkspace();
});

function resetWorkspace() {
  document.getElementById("ctxCompany").value = "";
  document.getElementById("ctxIndustry").value = "";
  document.getElementById("ctxAudience").value = "";
  document.getElementById("ctxObjective").value = "";
  document.getElementById("rawInputText").value = "";
  const fileEl = document.getElementById("fileUploadInput");
  if (fileEl) fileEl.value = "";

  AppState.currentStep = 1;
  AppState.maxUnlockedStep = 1;
  AppState.normalizedCsv = "";
  AppState.step1Data = null;
  AppState.step2Data = null;
  AppState.step3Data = null;

  document.getElementById("step1ResultBox").classList.add("hidden");
  document.getElementById("step1ResultBox").innerHTML = "";
  jumpToStep(1, true);
}

function getContextFromForm() {
  return {
    company_name: document.getElementById("ctxCompany").value.trim() || "Doanh nghiệp của bạn",
    industry: document.getElementById("ctxIndustry").value.trim() || "Đa ngành (Business Intelligence)",
    target_audience: document.getElementById("ctxAudience").value.trim() || "Ban Giám đốc (CEO / CFO)",
    objective: document.getElementById("ctxObjective").value.trim() || "Phân tích số liệu BI & Tối ưu hiệu quả hoạt động"
  };
}

// Handle file upload (.csv, .xlsx, .json)
async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload-file", {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.detail || "Không thể đọc file.");
      return;
    }
    const data = await res.json();
    document.getElementById("rawInputText").value = data.raw_input || "";
    runStep1Validation();
  } catch (e) {
    alert("Lỗi tải file: " + e.message);
  }
}

// Navigation between steps
function jumpToStep(stepNum, force = false) {
  if (!force && stepNum > AppState.maxUnlockedStep) {
    return;
  }
  AppState.currentStep = stepNum;
  for (let i = 1; i <= 4; i++) {
    const panel = document.getElementById(`panelStep${i}`);
    const wf = document.getElementById(`wfStep${i}`);
    const status = document.getElementById(`wfStatus${i}`);
    if (panel) panel.classList.toggle("active", i === stepNum);
    if (wf) {
      wf.classList.remove("active", "done");
      if (i === stepNum) {
        wf.classList.add("active");
        if (status) status.textContent = "Đang thực hiện";
      } else if (i < AppState.maxUnlockedStep || i < stepNum) {
        wf.classList.add("done");
        if (status) status.textContent = "Hoàn tất ✓";
      } else {
        if (status) status.textContent = "Chờ";
      }
    }
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================================
// STEP 1: CONTEXT ANALYSIS & FORMAT CHECK
// ============================================================================
async function runStep1Validation() {
  const rawInput = document.getElementById("rawInputText").value.trim();
  if (!rawInput) {
    alert("Vui lòng nhập hoặc dán dữ liệu của bạn (hoặc tải file CSV/Excel/JSON lên) trước khi phân tích.");
    document.getElementById("rawInputText").focus();
    return;
  }

  const context = getContextFromForm();
  const resultBox = document.getElementById("step1ResultBox");
  resultBox.classList.remove("hidden");
  resultBox.innerHTML = `<div class="card"><p>⏳ AI đang phân tích bối cảnh doanh nghiệp và kiểm tra định dạng dữ liệu của bạn...</p></div>`;

  try {
    const res = await fetch("/api/step1/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, raw_input: rawInput })
    });
    const data = await res.json();
    AppState.step1Data = data;
    renderStep1DecisionGate(data);
  } catch (e) {
    resultBox.innerHTML = `<div class="card"><p style="color:#dc2626;">Lỗi kiểm tra định dạng: ${e.message}</p></div>`;
  }
}

function renderStep1DecisionGate(data) {
  const resultBox = document.getElementById("step1ResultBox");
  const ctxInfo = data.context_analysis || {};

  if (data.is_valid) {
    AppState.normalizedCsv = data.normalized_csv || document.getElementById("rawInputText").value;
    resultBox.innerHTML = `
      <div class="format-box valid">
        <div class="format-header">
          <div>
            <span class="format-badge-valid">✓ ĐÚNG ĐỊNH DẠNG (${escapeHtml(data.format_type)} • Độ tin cậy ${data.confidence}%)</span>
            <h3 style="margin-top:8px; color:#14532d;">Dữ liệu đạt chuẩn cấu trúc bảng (${data.row_count} dòng × ${data.column_count} cột)</h3>
          </div>
          <button class="btn-success btn-lg" onclick="proceedToStep2()">
            Tiếp tục sang BƯỚC 2: Làm sạch Dữ liệu →
          </button>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1.5fr; gap:14px; margin-top:10px;">
          <div style="background:#ffffff; border:1px solid #bbf7d0; border-radius:8px; padding:12px 14px; font-size:0.83rem;">
            <div style="font-weight:700; color:#166534; margin-bottom:6px;">🧠 AI Phân tích Bối cảnh Doanh nghiệp:</div>
            <p><strong>Doanh nghiệp:</strong> ${escapeHtml(ctxInfo.company_name)}</p>
            <p><strong>Ngành nghề:</strong> ${escapeHtml(ctxInfo.detected_domain)}</p>
            <p><strong>Mục tiêu:</strong> ${escapeHtml(ctxInfo.objective)}</p>
            <p style="margin-top:6px; font-weight:600;">Các trường dữ liệu phát hiện:</p>
            <ul style="margin-left:18px; margin-top:4px; color:#334155;">
              ${(ctxInfo.recommended_kpis || []).map(k => `<li>${escapeHtml(k)}</li>`).join("")}
            </ul>
          </div>

          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
            <div style="background:#f1f5f9; padding:6px 12px; font-size:0.78rem; font-weight:700;">
              Xem trước cấu trúc cột (${data.columns.length} cột): ${data.columns.slice(0, 8).join(", ")}${data.columns.length > 8 ? "..." : ""}
            </div>
            <div class="table-scroll-wrapper" style="max-height:175px;">
              ${buildSimplePreviewTable(data.columns, data.preview_rows.slice(0, 5))}
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    resultBox.innerHTML = `
      <div class="format-box invalid">
        <div class="format-header">
          <div>
            <span class="format-badge-invalid">✕ SAI ĐỊNH DẠNG (${escapeHtml(data.format_type)})</span>
            <h3 style="margin-top:8px; color:#991b1b;">Phát hiện lỗi cấu trúc định dạng dữ liệu đầu vào!</h3>
          </div>
        </div>

        <div class="error-list-box">
          <strong>⚠️ Chi tiết lỗi định dạng AI phát hiện:</strong>
          <ul>
            ${(data.errors || []).map(err => `<li>${escapeHtml(err)}</li>`).join("")}
          </ul>
        </div>

        <h4 style="font-size:0.92rem; color:#1e293b;">Vui lòng chọn 1 trong 2 phương án xử lý theo quy trình:</h4>
        <div class="two-options-grid">
          <!-- Option 1: Manual Re-entry -->
          <div class="option-card">
            <h4>✍️ Lựa chọn 1: Nhập lại / Chỉnh sửa thủ công</h4>
            <p>Tự chỉnh sửa lại văn bản dữ liệu thô, tách cột bằng dấu phẩy (CSV) chuẩn hoặc tải lên một file dữ liệu khác.</p>
            <button class="btn-outline-sm" onclick="focusRawInputManual()">
              👆 Nhập / Sửa lại thủ công tại ô Dữ liệu
            </button>
          </div>

          <!-- Option 2: AI Auto-Format Suggestion -->
          <div class="option-card option-ai">
            <h4>🤖 Lựa chọn 2: AI gợi ý điền / chuẩn hóa lại đúng định dạng</h4>
            <p>AI Agent sẽ tự động phân tích dữ liệu của bạn, tách các trường bị gộp, loại bỏ dòng ghi chú thừa và điền lại thành bảng chuẩn.</p>
            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <input type="text" id="aiFormatHintInput" placeholder="Ghi chú thêm cho AI (tùy chọn)..." style="flex:1; padding:6px 10px; border:1px solid #fcd34d; border-radius:6px; font-size:0.8rem;" />
              <button class="btn-primary" onclick="runStep1AiReformat()">
                ✨ AI Gợi Ý & Điền Lại Đúng Định Dạng
              </button>
            </div>
          </div>
        </div>

        <div id="aiReformatPreviewContainer" class="hidden" style="margin-top:16px;"></div>
      </div>
    `;
  }
  resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function focusRawInputManual() {
  const rawEl = document.getElementById("rawInputText");
  rawEl.focus();
  rawEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function runStep1AiReformat() {
  const context = getContextFromForm();
  const rawInput = document.getElementById("rawInputText").value;
  const userHint = document.getElementById("aiFormatHintInput")?.value || "";
  const container = document.getElementById("aiReformatPreviewContainer");
  container.classList.remove("hidden");
  container.innerHTML = `<p style="padding:12px; font-weight:600; color:#1565c0;">⏳ AI đang tái cấu trúc và điền lại bảng dữ liệu của bạn đúng định dạng...</p>`;

  try {
    const res = await fetch("/api/step1/ai-reformat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, raw_input: rawInput, user_hint: userHint })
    });
    const data = await res.json();
    AppState.normalizedCsv = data.reconstructed_csv;

    container.innerHTML = `
      <div class="ai-log-list">
        <strong>✅ AI đã chuẩn hóa và điền lại định dạng bảng thành công (${data.row_count} dòng × ${data.column_count} cột):</strong>
        <ul style="margin-left:18px; margin-top:6px;">
          ${(data.ai_actions_log || []).map(l => `<li>${escapeHtml(l)}</li>`).join("")}
        </ul>
      </div>
      <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; margin-bottom:12px;">
        <div style="background:#1e3a5f; color:#fff; padding:7px 12px; font-size:0.8rem; font-weight:600;">
          Bản xem trước Dữ liệu sau khi AI điền lại đúng định dạng:
        </div>
        <div class="table-scroll-wrapper" style="max-height:220px;">
          ${buildSimplePreviewTable(data.columns, data.preview_rows)}
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn-outline-sm" onclick="applyReformattedToTextarea()">📝 Cập nhật vào ô Dữ liệu gốc</button>
        <button class="btn-success btn-lg" onclick="applyReformattedAndGoStep2()">
          ✅ Xác nhận Định dạng AI Gợi ý & Sang BƯỚC 2 →
        </button>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<p style="color:#dc2626;">Lỗi chuẩn hóa định dạng: ${e.message}</p>`;
  }
}

function applyReformattedToTextarea() {
  if (AppState.normalizedCsv) {
    document.getElementById("rawInputText").value = AppState.normalizedCsv;
    runStep1Validation();
  }
}

function applyReformattedAndGoStep2() {
  if (AppState.normalizedCsv) {
    document.getElementById("rawInputText").value = AppState.normalizedCsv;
  }
  proceedToStep2();
}

async function proceedToStep2() {
  AppState.maxUnlockedStep = Math.max(AppState.maxUnlockedStep, 2);
  jumpToStep(2, true);
  await runStep2Cleaning("");
}

// ============================================================================
// STEP 2: DATA CLEANING & HUMAN-IN-THE-LOOP CONFIRMATION
// ============================================================================
async function runStep2Cleaning(customInstruction = "") {
  const context = getContextFromForm();
  const rawCsv = AppState.normalizedCsv || document.getElementById("rawInputText").value;

  const issuesContainer = document.getElementById("issuesListContainer");
  issuesContainer.innerHTML = `<p style="padding:12px;">⏳ AI đang quét lỗi dữ liệu thô và thực hiện làm sạch...</p>`;

  try {
    const res = await fetch("/api/step2/clean", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context,
        raw_csv: rawCsv,
        custom_instruction: customInstruction
      })
    });
    const data = await res.json();
    AppState.step2Data = data;
    renderStep2View(data);
  } catch (e) {
    issuesContainer.innerHTML = `<p style="color:#dc2626; padding:12px;">Lỗi làm sạch: ${e.message}</p>`;
  }
}

function renderStep2View(data) {
  const s = data.summary || {};
  document.getElementById("step2ScoreBadges").innerHTML = `
    <span class="step-pill" style="background:#64748b;">Chất lượng dữ liệu thô: ${s.quality_score_before}%</span>
    <span style="margin:0 6px; font-weight:700;">→</span>
    <span class="step-pill" style="background:#16a34a;">Sau khi AI làm sạch: ${s.quality_score_after}%</span>
  `;

  document.getElementById("step2SummaryRow").innerHTML = `
    <div class="clean-stat-card">
      <div class="clean-stat-label">Số bản ghi (Trước → Sau làm sạch)</div>
      <div class="clean-stat-val">${s.rows_before} → ${s.rows_after} dòng</div>
    </div>
    <div class="clean-stat-card">
      <div class="clean-stat-label">Tổng số lỗi phát hiện & xử lý</div>
      <div class="clean-stat-val" style="color:#ea580c;">${s.issues_count} lỗi dữ liệu</div>
    </div>
    <div class="clean-stat-card">
      <div class="clean-stat-label">Số trường chỉ số (Columns)</div>
      <div class="clean-stat-val">${s.total_columns} cột chuẩn</div>
    </div>
    <div class="clean-stat-card">
      <div class="clean-stat-label">Trạng thái Kiểm định</div>
      <div class="clean-stat-val" style="color:#16a34a; font-size:1.1rem;">Chờ bạn xác nhận ✓</div>
    </div>
  `;

  const customBanner = document.getElementById("step2CustomRulesLog");
  if (data.custom_rules_applied && data.custom_rules_applied.length > 0) {
    customBanner.classList.remove("hidden");
    customBanner.innerHTML = `
      <strong>✨ AI đã thực thi yêu cầu làm sạch tùy chỉnh của bạn:</strong>
      <ul style="margin-left:18px; margin-top:4px;">
        ${data.custom_rules_applied.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
      </ul>
    `;
  } else {
    customBanner.classList.add("hidden");
  }

  document.getElementById("issueCountPill").textContent = `${(data.issues || []).length} lỗi đã sửa`;
  const issuesList = document.getElementById("issuesListContainer");
  if (!data.issues || data.issues.length === 0) {
    issuesList.innerHTML = `<div style="padding:18px; color:#166534; font-weight:600;">🎉 Dữ liệu của bạn không có lỗi định dạng số, ô trống hay trùng lặp nào! Bạn có thể bấm Xác nhận ĐẠT hoặc chỉnh sửa trực tiếp trên bảng bên phải.</div>`;
  } else {
    issuesList.innerHTML = data.issues.map((iss, idx) => `
      <div class="issue-item">
        <div class="issue-item-top">
          <span>#${idx + 1} • ${escapeHtml(iss.issue_type)}</span>
          <span>Dòng ${iss.row} | Cột: ${escapeHtml(iss.column)}</span>
        </div>
        <div class="issue-diff">
          <span class="val-raw">${escapeHtml(iss.raw_value)}</span>
          <span>→</span>
          <span class="val-clean">${escapeHtml(iss.cleaned_value)}</span>
        </div>
        <div class="issue-reason">💡 ${escapeHtml(iss.reason)}</div>
      </div>
    `).join("");
  }

  renderEditableCleanedTable(data);
}

function renderEditableCleanedTable(data) {
  const cols = data.columns || [];
  const rows = data.cleaned_rows || [];

  const html = `
    <table class="data-table" id="step2EditableGrid">
      <thead>
        <tr>
          <th>#</th>
          ${cols.map(c => `<th>${escapeHtml(c)}</th>`).join("")}
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, rIdx) => `
          <tr data-row-idx="${rIdx}">
            <td style="font-weight:700; color:#64748b;">${rIdx + 1}</td>
            ${cols.map(c => {
              const isHighlighted = (data.issues || []).some(iss => iss.column === c && (iss.row - 1) === rIdx);
              return `<td contenteditable="true"
                          class="${isHighlighted ? 'cell-cleaned' : ''}"
                          data-col="${escapeHtml(c)}"
                          onblur="handleManualCellEdit(${rIdx}, '${escapeHtml(c)}', this.innerText)">${escapeHtml(String(r[c] ?? ""))}</td>`;
            }).join("")}
            <td>
              <button class="btn-xs" style="color:#dc2626;" onclick="deleteRowStep2(${rIdx})" title="Xóa dòng này">✕</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  document.getElementById("cleanedTableContainer").innerHTML = html;
}

function handleManualCellEdit(rowIdx, colName, newValue) {
  if (!AppState.step2Data || !AppState.step2Data.cleaned_rows[rowIdx]) return;
  AppState.step2Data.cleaned_rows[rowIdx][colName] = newValue.trim();
}

function deleteRowStep2(rowIdx) {
  if (!AppState.step2Data) return;
  AppState.step2Data.cleaned_rows.splice(rowIdx, 1);
  AppState.step2Data.summary.rows_after = AppState.step2Data.cleaned_rows.length;
  renderStep2View(AppState.step2Data);
}

function addNewRowStep2() {
  if (!AppState.step2Data) return;
  const newRow = {};
  (AppState.step2Data.columns || []).forEach((c, idx) => {
    newRow[c] = idx === 0 ? "Kỳ mới" : "0";
  });
  AppState.step2Data.cleaned_rows.push(newRow);
  AppState.step2Data.summary.rows_after = AppState.step2Data.cleaned_rows.length;
  renderStep2View(AppState.step2Data);
}

function toggleStep2ReCleanBox() {
  const box = document.getElementById("step2ReCleanBox");
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) {
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function focusEditableTable() {
  const tbl = document.getElementById("cleanedTableContainer");
  tbl.scrollIntoView({ behavior: "smooth", block: "center" });
  const firstCell = tbl.querySelector('td[contenteditable="true"]');
  if (firstCell) firstCell.focus();
}

function setReCleanPrompt(text) {
  document.getElementById("customCleanInput").value = text;
}

async function runCustomAiReClean() {
  const instr = document.getElementById("customCleanInput").value.trim();
  if (!instr) {
    alert("Vui lòng nhập yêu cầu làm sạch lại cho AI.");
    return;
  }
  await runStep2Cleaning(instr);
}

async function confirmStep2AndGoStep3() {
  AppState.maxUnlockedStep = Math.max(AppState.maxUnlockedStep, 3);
  jumpToStep(3, true);
  await runStep3Analysis("");
}

// ============================================================================
// STEP 3: BI DATA ANALYSIS & FEEDBACK EVALUATION
// ============================================================================
async function runStep3Analysis(userFeedback = "") {
  const context = getContextFromForm();
  const cleanedRows = AppState.step2Data?.cleaned_rows || [];
  const container = document.getElementById("step3FeedbackContainer");
  container.innerHTML = `<div class="card"><p>⏳ AI đang phân tích dữ liệu sạch của bạn và tổng hợp nhận định BI...</p></div>`;

  try {
    const res = await fetch("/api/step3/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context,
        cleaned_rows: cleanedRows,
        user_feedback: userFeedback
      })
    });
    const data = await res.json();
    AppState.step3Data = data;
    renderStep3Feedback(data);
  } catch (e) {
    container.innerHTML = `<div class="card"><p style="color:#dc2626;">Lỗi phân tích Bước 3: ${e.message}</p></div>`;
  }
}

function renderStep3Feedback(data) {
  document.getElementById("step3SummaryHint").textContent = data.executive_summary_line || "";
  const sections = data.feedback_sections || [];
  const actionMatrix = data.action_plan_matrix || [];
  const container = document.getElementById("step3FeedbackContainer");

  const cardsHtml = sections.map((sec) => `
    <div class="feedback-card">
      <span class="feedback-badge">${escapeHtml(sec.badge)}</span>
      <h4>${escapeHtml(sec.title)}</h4>
      <div class="feedback-body">${formatMarkdownBold(escapeHtml(sec.content))}</div>
      ${sec.metrics && sec.metrics.length > 0 ? `
        <div class="feedback-metrics-row">
          ${sec.metrics.map(m => `
            <div class="fb-mini-metric">
              <div class="fb-mini-label">${escapeHtml(m.label)}</div>
              <div class="fb-mini-val">${escapeHtml(m.value)}</div>
              <div class="fb-mini-trend">${escapeHtml(m.trend)}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `).join("");

  const matrixHtml = actionMatrix.length > 0 ? `
    <div style="grid-column: 1 / -1; background:#ffffff; border:1.5px solid #1565c0; border-radius:8px; overflow:hidden; margin-top:4px;">
      <div style="background:#1e3a5f; color:#ffffff; padding:10px 16px; font-size:0.9rem; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
        <span>🎯 BẢNG GIẢI PHÁP THỰC TẾ & ĐO LƯỜNG HIỆU QUẢ DOANH NGHIỆP (MEASURABLE SMART ACTION PLAN)</span>
        <span style="font-size:0.75rem; background:rgba(255,255,255,0.18); padding:2px 8px; border-radius:99px;">Đo lường bằng KPI định lượng</span>
      </div>
      <div class="table-scroll-wrapper" style="max-height:none;">
        <table class="data-table" style="white-space:normal;">
          <thead>
            <tr>
              <th style="width:14%; background:#f1f5f9; color:#0f172a; border-bottom:2px solid #cbd5e1;">Hạng mục Giải pháp</th>
              <th style="width:23%; background:#f1f5f9; color:#0f172a; border-bottom:2px solid #cbd5e1;">Vấn đề Thực tế từ Dữ liệu</th>
              <th style="width:26%; background:#f1f5f9; color:#0f172a; border-bottom:2px solid #cbd5e1;">Giải pháp Triển khai Cụ thể</th>
              <th style="width:21%; background:#f1f5f9; color:#0f172a; border-bottom:2px solid #cbd5e1;">Chỉ số Đo lường (KPI Target)</th>
              <th style="width:16%; background:#f1f5f9; color:#0f172a; border-bottom:2px solid #cbd5e1;">Tác động Định lượng</th>
            </tr>
          </thead>
          <tbody>
            ${actionMatrix.map(row => `
              <tr>
                <td style="vertical-align:top; white-space:normal; font-weight:700; color:#1e3a5f;">
                  <span style="display:inline-block; background:#dbeafe; color:#1e40af; padding:1px 6px; border-radius:4px; font-size:0.7rem; margin-bottom:4px;">${escapeHtml(row.code)}</span><br/>
                  ${escapeHtml(row.area)}
                </td>
                <td style="vertical-align:top; white-space:normal; color:#334155;">${formatMarkdownBold(escapeHtml(row.problem))}</td>
                <td style="vertical-align:top; white-space:normal; color:#0f172a; font-weight:500;">${formatMarkdownBold(escapeHtml(row.solution))}</td>
                <td style="vertical-align:top; white-space:pre-line; color:#166534; font-weight:600; background:#f0fdf4;">${escapeHtml(row.kpi_metric)}</td>
                <td style="vertical-align:top; white-space:normal; color:#9a3412; font-weight:700; background:#fff7ed;">${escapeHtml(row.quantified_impact)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  ` : "";

  container.innerHTML = cardsHtml + matrixHtml;
}

function toggleStep3AdjustBox() {
  const box = document.getElementById("step3AdjustBox");
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) {
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

async function runStep3ReAnalysis() {
  const fb = document.getElementById("step3FeedbackInput").value.trim();
  if (!fb) {
    alert("Vui lòng nhập nội dung điều chỉnh / phản hồi cho AI.");
    return;
  }
  await runStep3Analysis(fb);
}

function confirmStep3AndGoStep4(initialMode = "dashboard") {
  AppState.maxUnlockedStep = 4;
  jumpToStep(4, true);
  renderStep4DashboardAndReport(AppState.step3Data);
  switchStep4View(initialMode);
}

// ============================================================================
// STEP 4: EXECUTIVE BI DASHBOARD & REPORT
// ============================================================================
function switchStep4View(mode) {
  const dashView = document.getElementById("step4DashboardView");
  const repView = document.getElementById("step4ReportView");
  const tabDash = document.getElementById("tabViewDashboard");
  const tabRep = document.getElementById("tabViewReport");

  if (mode === "report") {
    dashView.classList.add("hidden");
    repView.classList.remove("hidden");
    tabDash.classList.remove("active");
    tabRep.classList.add("active");
  } else {
    repView.classList.add("hidden");
    dashView.classList.remove("hidden");
    tabRep.classList.remove("active");
    tabDash.classList.add("active");
  }
}

function renderStep4DashboardAndReport(step3Data) {
  if (!step3Data || !step3Data.dashboard) return;
  const dash = step3Data.dashboard;

  document.getElementById("dashMainTitle").textContent = dash.title || "Executive Management";
  document.getElementById("dashDomainSubtitle").textContent = dash.subtitle || "Business Intelligence";

  // Initialize Dynamic Slicers & Render Aggregated Dashboard
  initDashboardSlicers(step3Data);
  updateDashboardFromSlicers();

  // Render Executive BI Report (Tab 2)
  renderExecutiveReportHtml(step3Data);
}

function extractMonthYearFromDateStr(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  // Match YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[/\-\.](\d{1,2})[/\-\.]\d{1,2}$/);
  if (m) return `${m[2].padStart(2, "0")}/${m[1]}`;
  // Match DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^\d{1,2}[/\-\.](\d{1,2})[/\-\.](\d{4})$/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2]}`;
  return s.slice(0, 10);
}

function parseNumSafe(val) {
  if (val === null || val === undefined) return 0;
  const s = String(val).replace(/[\$,%\s]/g, "").trim();
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function formatVietnameseBigNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return "0";
  const absV = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (absV >= 1_000_000_000) {
    return `${sign}${(absV / 1_000_000_000).toFixed(2)} Tỷ`;
  }
  if (absV >= 1_000_000) {
    return `${sign}${(absV / 1_000_000).toFixed(2)} Triệu`;
  }
  if (absV >= 10_000) {
    return `${sign}${Math.round(absV).toLocaleString("en-US")}`;
  }
  return `${sign}${absV % 1 === 0 ? absV.toLocaleString("en-US") : absV.toFixed(2)}`;
}

function initDashboardSlicers(step3Data) {
  const rows = AppState.step2Data?.cleaned_rows || [];
  const allCols = AppState.step2Data?.columns || [];
  const meta = step3Data.column_metadata || {};

  const numCols = (meta.numeric_cols && meta.numeric_cols.length > 0)
    ? meta.numeric_cols
    : allCols.filter(c => rows.some(r => !isNaN(Number(r[c])) && String(r[c]).trim() !== ""));

  const dateCols = meta.date_cols || [];
  const primaryDateCol = dateCols[0] || "";

  // Pick categorical columns suitable for Slicers (2 to 50 unique values)
  const catCols = (meta.slicer_cols && meta.slicer_cols.length > 0)
    ? meta.slicer_cols
    : allCols.filter(c => !numCols.includes(c) && !dateCols.includes(c));

  const slicerCol1 = catCols[0] || "";
  const slicerCol2 = catCols[1] || "";

  AppState.dashConfig = {
    numCols,
    primaryDateCol,
    catCols,
    slicerCol1,
    slicerCol2,
    labelCol: meta.label_col || allCols[0] || ""
  };

  // Build unique Month/Year options if primaryDateCol exists
  let periodOptions = [];
  if (primaryDateCol) {
    const pSet = new Set();
    rows.forEach(r => {
      const p = extractMonthYearFromDateStr(r[primaryDateCol]);
      if (p) pSet.add(p);
    });
    periodOptions = Array.from(pSet).sort((a, b) => {
      const [ma, ya] = a.split("/");
      const [mb, yb] = b.split("/");
      return (Number(ya) * 100 + Number(ma)) - (Number(yb) * 100 + Number(mb));
    });
  }

  const getUniqueVals = (col) => {
    if (!col) return [];
    const s = new Set();
    rows.forEach(r => {
      const v = String(r[col] ?? "").trim();
      if (v) s.add(v);
    });
    return Array.from(s).slice(0, 40);
  };

  const s1Options = getUniqueVals(slicerCol1);
  const s2Options = getUniqueVals(slicerCol2);
  const groupColChoices = catCols.length > 0 ? catCols : [AppState.dashConfig.labelCol];

  const slicerBar = document.getElementById("execSlicerBar");
  slicerBar.innerHTML = `
    <div class="slicer-controls-left">
      <div class="slicer-group">
        <span class="slicer-label">📈 Chỉ số Phân tích chính (Metric)</span>
        <select class="slicer-select" id="slicerMetric" onchange="updateDashboardFromSlicers()">
          ${numCols.map((c, idx) => `<option value="${escapeHtml(c)}" ${idx === 0 ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
        </select>
      </div>

      ${groupColChoices.length > 0 && groupColChoices[0] ? `
        <div class="slicer-group">
          <span class="slicer-label">📂 Nhóm Biểu đồ theo (Dimension)</span>
          <select class="slicer-select" id="slicerGroupBy" onchange="updateDashboardFromSlicers()">
            ${groupColChoices.map((c, idx) => `<option value="${escapeHtml(c)}" ${idx === 0 ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
          </select>
        </div>
      ` : ""}

      ${primaryDateCol && periodOptions.length > 1 ? `
        <div class="slicer-group">
          <span class="slicer-label">📅 Kỳ thời gian (${escapeHtml(primaryDateCol)})</span>
          <select class="slicer-select" id="slicerPeriod" onchange="updateDashboardFromSlicers()">
            <option value="ALL">Tất cả các kỳ (${periodOptions.length} kỳ)</option>
            ${periodOptions.map(p => `<option value="${escapeHtml(p)}">Tháng ${escapeHtml(p)}</option>`).join("")}
          </select>
        </div>
      ` : ""}

      ${slicerCol1 && s1Options.length > 1 ? `
        <div class="slicer-group">
          <span class="slicer-label">🏷️ Lọc ${escapeHtml(slicerCol1)}</span>
          <select class="slicer-select" id="slicerCat1" onchange="updateDashboardFromSlicers()">
            <option value="ALL">Tất cả (${s1Options.length})</option>
            ${s1Options.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v.slice(0, 32))}</option>`).join("")}
          </select>
        </div>
      ` : ""}

      ${slicerCol2 && s2Options.length > 1 ? `
        <div class="slicer-group">
          <span class="slicer-label">🏢 Lọc ${escapeHtml(slicerCol2)}</span>
          <select class="slicer-select" id="slicerCat2" onchange="updateDashboardFromSlicers()">
            <option value="ALL">Tất cả (${s2Options.length})</option>
            ${s2Options.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v.slice(0, 32))}</option>`).join("")}
          </select>
        </div>
      ` : ""}
    </div>

    <div class="slicer-status-right">
      <span id="slicerCountBadge">Đang hiển thị: ${rows.length} / ${rows.length} bản ghi</span>
      <button class="btn-xs" onclick="resetDashboardSlicers()">↺ Xóa bộ lọc</button>
    </div>
  `;
}

function resetDashboardSlicers() {
  ["slicerPeriod", "slicerCat1", "slicerCat2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "ALL";
  });
  updateDashboardFromSlicers();
}

function updateDashboardFromSlicers() {
  const allRows = AppState.step2Data?.cleaned_rows || [];
  if (!allRows.length) return;

  const cfg = AppState.dashConfig || {};
  const primaryMetric = document.getElementById("slicerMetric")?.value || cfg.numCols?.[0] || "";
  const secondaryMetric = (cfg.numCols || []).find(c => c !== primaryMetric) || primaryMetric;
  const groupCol = document.getElementById("slicerGroupBy")?.value || cfg.slicerCol1 || cfg.labelCol || "";
  const periodFilter = document.getElementById("slicerPeriod")?.value || "ALL";
  const cat1Filter = document.getElementById("slicerCat1")?.value || "ALL";
  const cat2Filter = document.getElementById("slicerCat2")?.value || "ALL";

  // 1. Filter rows according to active Slicers
  const filteredRows = allRows.filter(r => {
    if (periodFilter !== "ALL" && cfg.primaryDateCol) {
      if (extractMonthYearFromDateStr(r[cfg.primaryDateCol]) !== periodFilter) return false;
    }
    if (cat1Filter !== "ALL" && cfg.slicerCol1) {
      if (String(r[cfg.slicerCol1] ?? "").trim() !== cat1Filter) return false;
    }
    if (cat2Filter !== "ALL" && cfg.slicerCol2) {
      if (String(r[cfg.slicerCol2] ?? "").trim() !== cat2Filter) return false;
    }
    return true;
  });

  const countBadge = document.getElementById("slicerCountBadge");
  if (countBadge) {
    countBadge.textContent = `Đang hiển thị: ${filteredRows.length} / ${allRows.length} bản ghi`;
  }

  const rowsToUse = filteredRows.length > 0 ? filteredRows : allRows;

  // 2. Compute Real Business KPIs on rowsToUse
  const primaryVals = rowsToUse.map(r => parseNumSafe(r[primaryMetric]));
  const secondaryVals = rowsToUse.map(r => parseNumSafe(r[secondaryMetric]));
  const totalPrimary = primaryVals.reduce((a, b) => a + b, 0);
  const avgPrimary = primaryVals.length ? totalPrimary / primaryVals.length : 0;
  const maxPrimary = primaryVals.length ? Math.max(...primaryVals) : 0;
  const totalSecondary = secondaryVals.reduce((a, b) => a + b, 0);

  const highValueRows = primaryVals.filter(v => v >= avgPrimary);
  const highValueSum = highValueRows.reduce((a, b) => a + b, 0);
  const paretoSharePct = totalPrimary > 0 ? (highValueSum / totalPrimary) * 100 : 0;

  // Sparkline sampled to max 20 points so it always looks smooth
  const sparkSample = sampleArray(primaryVals, 20);
  const sparkSample2 = sampleArray(secondaryVals, 20);

  const kpiCards = [
    {
      title: `Tổng ${primaryMetric}`,
      value: formatVietnameseBigNumber(totalPrimary),
      sub: `Chính xác: ${Math.round(totalPrimary).toLocaleString("en-US")} • ${rowsToUse.length} bản ghi`,
      color: "#1565c0",
      borderColor: "#1565c0",
      bg_tint: "rgba(21, 101, 192, 0.14)",
      sparkline: sparkSample
    },
    {
      title: secondaryMetric !== primaryMetric ? `Tổng ${secondaryMetric}` : `Quy mô Đỉnh (${primaryMetric})`,
      value: secondaryMetric !== primaryMetric ? formatVietnameseBigNumber(totalSecondary) : formatVietnameseBigNumber(maxPrimary),
      sub: secondaryMetric !== primaryMetric
        ? `Trung bình: ${formatVietnameseBigNumber(totalSecondary / Math.max(rowsToUse.length, 1))} / bản ghi`
        : `Gấp ${(maxPrimary / Math.max(avgPrimary, 1)).toFixed(1)} lần mức trung bình`,
      color: "#e05a47",
      borderColor: "#e05a47",
      bg_tint: "rgba(224, 90, 71, 0.14)",
      sparkline: sparkSample2
    },
    {
      title: `Trung bình ${primaryMetric} / Đơn`,
      value: formatVietnameseBigNumber(avgPrimary),
      sub: `Cao nhất: ${formatVietnameseBigNumber(maxPrimary)}`,
      color: "#00897b",
      borderColor: "#00897b",
      bg_tint: "rgba(0, 137, 123, 0.12)",
      sparkline: null
    },
    {
      title: `Tỷ trọng Nhóm Trọng điểm`,
      value: `${paretoSharePct.toFixed(1)} %`,
      sub: `${highValueRows.length}/${rowsToUse.length} hồ sơ (>= mức TB) chiếm ${paretoSharePct.toFixed(1)}% quy mô`,
      color: "#1e3a5f",
      borderColor: "#f59e0b",
      bg_tint: "rgba(245, 158, 11, 0.12)",
      sparkline: null
    }
  ];

  const kpiRow = document.getElementById("execKpiRow");
  kpiRow.innerHTML = kpiCards.map((kpi) => {
    const sparkSvg = kpi.sparkline ? buildAreaSparklineSvg(kpi.sparkline, kpi.bg_tint) : "";
    return `
      <div class="exec-kpi-card" style="border-top-color:${kpi.borderColor};">
        <div>
          <div class="exec-kpi-title">${escapeHtml(kpi.title)}</div>
          <div class="exec-kpi-value" style="color:${kpi.color};">${escapeHtml(kpi.value)}</div>
        </div>
        <div class="exec-kpi-sub">${escapeHtml(kpi.sub)}</div>
        ${sparkSvg}
      </div>
    `;
  }).join("");

  // 3. Aggregate by `groupCol` (Category Distribution — Top 8 Groups!)
  const catMap = new Map();
  rowsToUse.forEach(r => {
    const rawCat = String(r[groupCol] ?? "Khác").trim() || "Khác";
    // Clean trailing quantity if grouping by Equipment/Product text
    const cleanCat = rawCat.split(";")[0].replace(/\s*x\s*\d+.*$/i, "").trim().slice(0, 26) || "Khác";
    const cur = catMap.get(cleanCat) || { sum1: 0, sum2: 0, count: 0 };
    cur.sum1 += parseNumSafe(r[primaryMetric]);
    cur.sum2 += parseNumSafe(r[secondaryMetric]);
    cur.count += 1;
    catMap.set(cleanCat, cur);
  });

  const sortedCats = Array.from(catMap.entries()).sort((a, b) => b[1].sum1 - a[1].sum1);
  const top8Cats = sortedCats.slice(0, 8);
  const catLabels = top8Cats.map(e => e[0]);
  const catSum1 = top8Cats.map(e => Math.round(e[1].sum1 * 100) / 100);
  const catCountOrAvg = top8Cats.map(e => Math.round((e[1].sum1 / Math.max(e[1].count, 1)) * 100) / 100);

  // 4. Render 4 Clean Gauges based on aggregated stats
  const aboveAvgRate = Math.round((highValueRows.length / Math.max(rowsToUse.length, 1)) * 100);
  const top1CatShare = totalPrimary > 0 && top8Cats.length > 0 ? Math.round((top8Cats[0][1].sum1 / totalPrimary) * 100) : 0;
  const activeGroupsCount = sortedCats.length;

  const gauges = [
    {
      title: "Tỷ trọng Nhóm Trọng điểm",
      subtitle: `[Pareto >= Trung bình]`,
      value: Math.round(paretoSharePct),
      display_value: `${paretoSharePct.toFixed(1)}%`,
      min: 0,
      max: 100,
      color: "#1565c0"
    },
    {
      title: "Tỷ lệ Đơn Vượt Chuẩn TB",
      subtitle: `[${highValueRows.length} / ${rowsToUse.length} bản ghi]`,
      value: aboveAvgRate,
      display_value: `${aboveAvgRate}%`,
      min: 0,
      max: 100,
      color: "#f2a900"
    },
    {
      title: "Tỷ trọng Nhóm #1 Dẫn đầu",
      subtitle: `[${top8Cats[0]?.[0] || "Top 1"}]`,
      value: top1CatShare,
      display_value: `${top1CatShare}%`,
      min: 0,
      max: 100,
      color: "#ef5350"
    },
    {
      title: "Số Nhóm Phân Loại Hoạt Động",
      subtitle: `[Theo ${groupCol}]`,
      value: Math.min(activeGroupsCount, 30),
      display_value: `${activeGroupsCount} Nhóm`,
      min: 0,
      max: Math.max(30, activeGroupsCount),
      color: "#00a65a"
    }
  ];

  document.getElementById("execGaugeRow").innerHTML = gauges.map((g) => `
    <div class="exec-gauge-card">
      <div class="exec-gauge-header">
        <div class="exec-gauge-title">${escapeHtml(g.title)}</div>
        <div class="exec-gauge-subtitle">${escapeHtml(g.subtitle)}</div>
      </div>
      <div class="exec-gauge-svg-wrap">
        ${buildExecutiveGaugeSvg(g)}
      </div>
    </div>
  `).join("");

  // Render Chart 1 (Top-Right): Aggregated Category Bar Chart (Max 8 bars!)
  document.getElementById("agingChartTitle").textContent = `Phân bổ ${primaryMetric} theo ${groupCol}`;
  document.getElementById("agingChartSubtitle").textContent = `Top ${top8Cats.length} nhóm dẫn đầu (Đã gộp nhóm)`;
  renderAgingGroupedBarChart({
    x_axis_label: groupCol,
    labels: catLabels,
    series: [
      { name: `Tổng ${primaryMetric}`, color: "#24588e", data: catSum1 },
      { name: `Trung bình / Đơn (${primaryMetric})`, color: "#f44336", data: catCountOrAvg }
    ]
  });

  // 5. Render Chart 2 (Bottom-Left): Time-Series Trend by Month/Year (Max 12 periods!)
  let trendLabels = [];
  let trendSumSeries = [];
  let trendAvgSeries = [];

  if (cfg.primaryDateCol) {
    const timeMap = new Map();
    rowsToUse.forEach(r => {
      const ym = extractMonthYearFromDateStr(r[cfg.primaryDateCol]) || "Khác";
      const cur = timeMap.get(ym) || { sum: 0, count: 0 };
      cur.sum += parseNumSafe(r[primaryMetric]);
      cur.count += 1;
      timeMap.set(ym, cur);
    });
    const sortedTime = Array.from(timeMap.entries()).sort((a, b) => {
      const [ma, ya] = a[0].split("/");
      const [mb, yb] = b[0].split("/");
      return (Number(ya || 0) * 100 + Number(ma || 0)) - (Number(yb || 0) * 100 + Number(mb || 0));
    }).slice(-12);

    trendLabels = sortedTime.map(e => e[0]);
    trendSumSeries = sortedTime.map(e => Math.round(e[1].sum * 100) / 100);
    trendAvgSeries = sortedTime.map(e => Math.round((e[1].sum / Math.max(e[1].count, 1)) * 100) / 100);
    document.getElementById("wcChartTitle").textContent = `Xu hướng ${primaryMetric} theo Kỳ Thời Gian (${cfg.primaryDateCol})`;
    document.getElementById("wcChartSubtitle").textContent = `${trendLabels.length} kỳ thời gian`;
  } else {
    trendLabels = catLabels;
    trendSumSeries = catSum1;
    trendAvgSeries = catCountOrAvg;
    document.getElementById("wcChartTitle").textContent = `So sánh Tổng & Trung bình ${primaryMetric} theo ${groupCol}`;
    document.getElementById("wcChartSubtitle").textContent = `Top ${trendLabels.length} nhóm`;
  }

  renderWorkingCapitalLineChart({
    y_axis_label: primaryMetric,
    labels: trendLabels,
    series: [
      { name: `Tổng ${primaryMetric}`, color: "#24588e", data: trendSumSeries },
      { name: `Trung bình / Bản ghi`, color: "#f2b705", data: trendAvgSeries }
    ]
  });

  // 6. Render Chart 3 (Bottom-Right): Top 10 Ranking by Entity / Customer / Project or Secondary Category (Max 10 bars!)
  const rankCol = (cfg.labelCol && cfg.labelCol !== groupCol) ? cfg.labelCol : groupCol;
  const rankMap = new Map();
  rowsToUse.forEach(r => {
    const k = String(r[rankCol] ?? "Khác").trim().slice(0, 24) || "Khác";
    const cur = rankMap.get(k) || { sum1: 0, count: 0 };
    cur.sum1 += parseNumSafe(r[primaryMetric]);
    cur.count += 1;
    rankMap.set(k, cur);
  });

  const top10Rank = Array.from(rankMap.entries())
    .sort((a, b) => b[1].sum1 - a[1].sum1)
    .slice(0, 10);

  const rankLabels = top10Rank.map(e => e[0]);
  const rankSum1 = top10Rank.map(e => Math.round(e[1].sum1 * 100) / 100);
  const rankCount = top10Rank.map(e => e[1].count);

  document.getElementById("pnlChartTitle").textContent = `Top ${top10Rank.length} ${rankCol} có ${primaryMetric} lớn nhất & Số lượng đơn`;
  document.getElementById("pnlChartSubtitle").textContent = `Xếp hạng Top ${top10Rank.length} (Không vẽ chồng chéo)`;

  renderPnLComboChart({
    left_axis_label: `Tổng ${primaryMetric}`,
    right_axis_label: "Số lượng bản ghi (Count)",
    labels: rankLabels,
    stacked_series: [
      { name: `Tổng ${primaryMetric}`, color: "#24588e", data: rankSum1 }
    ],
    profit_loss_series: {
      name: "Số bản ghi / Đơn hàng",
      positive_color: "#f2a900",
      negative_color: "#f44336",
      data: rankCount
    }
  });
}

function sampleArray(arr, maxPoints = 20) {
  if (!arr || arr.length <= maxPoints) return arr || [];
  const step = arr.length / maxPoints;
  const res = [];
  for (let i = 0; i < maxPoints; i++) {
    res.push(arr[Math.floor(i * step)]);
  }
  return res;
}

function buildAreaSparklineSvg(values, fillColor) {
  if (!values || values.length < 2) return "";
  const w = 220;
  const h = 44;
  const minV = Math.min(...values) * 0.92;
  const maxV = Math.max(...values) * 1.02 || 1;
  const stepX = w / (values.length - 1);

  const pts = values.map((v, idx) => {
    const x = (idx * stepX).toFixed(1);
    const ratio = (v - minV) / Math.max(maxV - minV, 1);
    const y = (h - 4 - ratio * (h - 10)).toFixed(1);
    return `${x},${y}`;
  });

  const polygonPoints = `0,${h} ${pts.join(" ")} ${w},${h}`;
  return `
    <svg class="exec-kpi-spark-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polygon points="${polygonPoints}" fill="${fillColor}" />
    </svg>
  `;
}

function buildExecutiveGaugeSvg(g) {
  const minVal = g.min ?? 0;
  const maxVal = g.max ?? 31;
  const rawVal = Math.max(minVal, Math.min(maxVal, Number(g.value) || 0));
  const ratio = (rawVal - minVal) / Math.max(maxVal - minVal, 1);

  const cx = 85;
  const cy = 78;
  const r = 54;
  const startAngle = 145;
  const totalSweep = 250;
  const endAngle = startAngle + totalSweep;
  const valAngle = startAngle + ratio * totalSweep;

  const trackPath = describeArc(cx, cy, r, startAngle, endAngle);
  const valuePath = ratio > 0.005 ? describeArc(cx, cy, r, startAngle, valAngle) : "";

  const needleRad = (valAngle * Math.PI) / 180;
  const tipX = cx + (r - 12) * Math.cos(needleRad);
  const tipY = cy + (r - 12) * Math.sin(needleRad);
  const baseLeftRad = needleRad - Math.PI / 2;
  const baseRightRad = needleRad + Math.PI / 2;
  const bRadius = 3.2;
  const bx1 = cx + bRadius * Math.cos(baseLeftRad);
  const by1 = cy + bRadius * Math.sin(baseLeftRad);
  const bx2 = cx + bRadius * Math.cos(baseRightRad);
  const by2 = cy + bRadius * Math.sin(baseRightRad);

  return `
    <svg width="170" height="148" viewBox="0 0 170 148">
      <path d="${trackPath}" fill="none" stroke="#e0e0e0" stroke-width="18" stroke-linecap="butt" />
      ${valuePath ? `<path d="${valuePath}" fill="none" stroke="${g.color}" stroke-width="18" stroke-linecap="butt" />` : ""}
      <polygon points="${tipX.toFixed(1)},${tipY.toFixed(1)} ${bx1.toFixed(1)},${by1.toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)}" fill="#616161" />
      <circle cx="${cx}" cy="${cy}" r="3.5" fill="#616161" />
      <text x="${cx}" y="119" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1e293b">${escapeHtml(g.display_value)}</text>
      <text x="45" y="138" text-anchor="middle" font-size="10.5" font-weight="600" fill="#334155">${minVal}</text>
      <text x="125" y="138" text-anchor="middle" font-size="10.5" font-weight="600" fill="#334155">${maxVal}</text>
    </svg>
  `;
}

function polarToCartesian(cx, cy, r, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians)
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x.toFixed(2), start.y.toFixed(2), "A", r, r, 0, largeArcFlag, 1, end.x.toFixed(2), end.y.toFixed(2)].join(" ");
}

function formatCompactMetric(val, withDollar = false) {
  if (val === null || val === undefined || isNaN(val)) return "";
  const absV = Math.abs(val);
  const prefix = withDollar ? "$" : "";
  let formatted = "";
  if (absV >= 1_000_000_000) {
    formatted = `${prefix}${(absV / 1_000_000_000).toFixed(2)}B`;
  } else if (absV >= 1_000_000) {
    formatted = `${prefix}${(absV / 1_000_000).toFixed(1)}M`;
  } else if (absV >= 1_000) {
    const kVal = absV / 1_000;
    formatted = `${prefix}${kVal % 1 === 0 ? kVal.toFixed(0) : kVal.toFixed(1)}K`;
  } else {
    formatted = `${prefix}${absV % 1 === 0 ? absV.toFixed(0) : absV.toFixed(1)}`;
  }
  return val < 0 ? `(${formatted})` : formatted;
}

function renderAgingGroupedBarChart(spec) {
  const ctx = document.getElementById("chartAging").getContext("2d");
  if (AppState.charts.aging) AppState.charts.aging.destroy();
  const showLabels = (spec.labels || []).length <= 10;

  AppState.charts.aging = new Chart(ctx, {
    type: "bar",
    data: {
      labels: spec.labels,
      datasets: spec.series.map((s) => ({
        label: s.name,
        data: s.data,
        backgroundColor: s.color,
        borderRadius: 4,
        barPercentage: 0.72,
        categoryPercentage: 0.68,
        datalabels: {
          display: showLabels,
          anchor: "end",
          align: "top",
          offset: 2,
          color: "#334155",
          font: { size: 9.5, weight: "600" },
          formatter: (v) => (v !== 0 ? formatCompactMetric(v) : "")
        }
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString("en-US")}`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: spec.x_axis_label || "Danh mục", font: { size: 10.5, weight: "600" } },
          grid: { display: false },
          ticks: { font: { size: 10 }, maxRotation: 25 }
        },
        y: {
          beginAtZero: true,
          grid: { color: "#edf2f7" },
          ticks: {
            font: { size: 10 },
            callback: (v) => formatCompactMetric(v)
          }
        }
      }
    }
  });
}

function renderWorkingCapitalLineChart(spec) {
  const ctx = document.getElementById("chartWorkingCapital").getContext("2d");
  if (AppState.charts.workingCapital) AppState.charts.workingCapital.destroy();
  const showLabels = (spec.labels || []).length <= 12;

  AppState.charts.workingCapital = new Chart(ctx, {
    type: "line",
    data: {
      labels: spec.labels,
      datasets: spec.series.map((s, idx) => ({
        label: s.name,
        data: s.data,
        borderColor: s.color,
        backgroundColor: idx === 0 ? "rgba(36, 88, 142, 0.10)" : "transparent",
        fill: idx === 0,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: s.color,
        pointBorderWidth: 2,
        pointRadius: 4,
        borderWidth: 2.2,
        tension: 0.25,
        datalabels: {
          display: showLabels && idx === 0,
          align: "top",
          offset: 5,
          color: "#1e293b",
          font: { size: 9.5, weight: "600" },
          formatter: (v) => formatCompactMetric(v)
        }
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, bottom: 8, right: 16, left: 6 } },
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, boxWidth: 10, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString("en-US")}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, maxRotation: 25 }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: spec.y_axis_label || "Giá trị", font: { size: 10.5, weight: "600" } },
          grid: { color: "#edf2f7" },
          ticks: {
            font: { size: 10 },
            callback: (v) => formatCompactMetric(v)
          }
        }
      }
    }
  });
}

function renderPnLComboChart(spec) {
  const ctx = document.getElementById("chartPnL").getContext("2d");
  if (AppState.charts.pnl) AppState.charts.pnl.destroy();
  const showLabels = (spec.labels || []).length <= 10;

  const barDatasets = (spec.stacked_series || []).map((s) => ({
    type: "bar",
    label: s.name,
    data: s.data,
    backgroundColor: s.color,
    borderRadius: 4,
    yAxisID: "yLeft",
    barPercentage: 0.65,
    categoryPercentage: 0.7,
    datalabels: {
      display: showLabels,
      anchor: "end",
      align: "top",
      offset: 2,
      color: "#1e3a5f",
      font: { size: 9.5, weight: "600" },
      formatter: (v) => (v !== 0 ? formatCompactMetric(v) : "")
    }
  }));

  const plData = spec.profit_loss_series.data || [];

  const lineOrBarDataset = {
    type: "line",
    label: spec.profit_loss_series.name,
    data: plData,
    borderColor: "#e67e22",
    backgroundColor: "#ffffff",
    pointBackgroundColor: "#e67e22",
    pointRadius: 4,
    borderWidth: 2.2,
    tension: 0.2,
    yAxisID: "yRight",
    datalabels: {
      display: false
    }
  };

  AppState.charts.pnl = new Chart(ctx, {
    type: "bar",
    data: {
      labels: spec.labels,
      datasets: [...barDatasets, lineOrBarDataset]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString("en-US")}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, maxRotation: 25 }
        },
        yLeft: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          title: { display: true, text: spec.left_axis_label || "Metrics", font: { size: 10.5, weight: "600" } },
          grid: { color: "#edf2f7" },
          ticks: {
            font: { size: 10 },
            callback: (v) => formatCompactMetric(v)
          }
        },
        yRight: {
          type: "linear",
          position: "right",
          stacked: false,
          title: { display: true, text: spec.right_axis_label || "Net", font: { size: 10.5 } },
          grid: { drawOnChartArea: false },
          ticks: {
            font: { size: 10 },
            callback: (v) => formatCompactMetric(v)
          }
        }
      }
    }
  });
}

function renderExecutiveReportHtml(step3Data) {
  const ctx = getContextFromForm();
  const dash = step3Data.dashboard;
  const sections = step3Data.feedback_sections || [];
  const actionMatrix = step3Data.action_plan_matrix || [];
  const cleanedRows = AppState.step2Data?.cleaned_rows || [];
  const cols = AppState.step2Data?.columns || [];

  const html = `
    <div class="report-paper">
      <div class="report-header-banner">
        <div>
          <div style="font-size:0.78rem; font-weight:700; color:#1565c0; letter-spacing:0.6px;">EXECUTIVE BUSINESS INTELLIGENCE REPORT</div>
          <h2 style="font-size:1.5rem; color:#0f172a; margin-top:4px;">${escapeHtml(ctx.company_name)} — Báo cáo Phân tích & Giải pháp Quản trị</h2>
          <p style="font-size:0.86rem; color:#475569;">Ngành nghề: ${escapeHtml(ctx.industry)} | Đối tượng: ${escapeHtml(ctx.target_audience)}</p>
        </div>
        <div style="text-align:right; font-size:0.8rem; color:#64748b;">
          <div>Ngày xuất bản: ${new Date().toLocaleDateString("vi-VN")}</div>
          <div>Trạng thái dữ liệu: <strong>Đã làm sạch & Xác nhận (HITL Verified)</strong></div>
        </div>
      </div>

      <h3 style="font-size:1.05rem; color:#1e3a5f; margin-bottom:12px;">I. Tổng hợp Chỉ số KPI Cốt lõi (Key Performance Indicators)</h3>
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px;">
        ${(dash.kpi_cards || []).map(k => `
          <div style="border:1px solid #cbd5e1; border-radius:6px; padding:12px; text-align:center;">
            <div style="font-size:0.78rem; color:#475569; font-weight:600;">${escapeHtml(k.title)}</div>
            <div style="font-size:1.35rem; font-weight:800; color:${k.color}; margin-top:4px;">${escapeHtml(k.value)}</div>
          </div>
        `).join("")}
      </div>

      <h3 style="font-size:1.05rem; color:#1e3a5f; margin-bottom:12px;">II. Phân tích Chuyên sâu từ Dữ liệu Thực tế</h3>
      <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:24px;">
        ${sections.map(s => `
          <div style="border-left:4px solid #1565c0; background:#f8fafc; padding:12px 16px; border-radius:0 6px 6px 0;">
            <div style="font-size:0.72rem; font-weight:800; color:#1565c0;">${escapeHtml(s.badge)}</div>
            <div style="font-size:0.95rem; font-weight:700; color:#0f172a; margin:4px 0 6px;">${escapeHtml(s.title)}</div>
            <div style="font-size:0.85rem; color:#334155; white-space:pre-line;">${formatMarkdownBold(escapeHtml(s.content))}</div>
          </div>
        `).join("")}
      </div>

      ${actionMatrix.length > 0 ? `
        <h3 style="font-size:1.05rem; color:#1e3a5f; margin-bottom:12px;">III. Kế hoạch Giải pháp Thực tế & Đo lường KPI (SMART Action Plan)</h3>
        <div style="border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; margin-bottom:24px;">
          <table class="data-table" style="white-space:normal;">
            <thead>
              <tr>
                <th style="width:15%;">Hạng mục</th>
                <th style="width:23%;">Vấn đề Thực tế</th>
                <th style="width:26%;">Giải pháp Triển khai</th>
                <th style="width:20%;">Chỉ số Đo lường (KPI)</th>
                <th style="width:16%;">Tác động Định lượng</th>
              </tr>
            </thead>
            <tbody>
              ${actionMatrix.map(row => `
                <tr>
                  <td style="vertical-align:top; white-space:normal; font-weight:700; color:#1e3a5f;">${escapeHtml(row.code)} — ${escapeHtml(row.area)}</td>
                  <td style="vertical-align:top; white-space:normal;">${formatMarkdownBold(escapeHtml(row.problem))}</td>
                  <td style="vertical-align:top; white-space:normal;">${formatMarkdownBold(escapeHtml(row.solution))}</td>
                  <td style="vertical-align:top; white-space:pre-line; color:#166534; font-weight:600;">${escapeHtml(row.kpi_metric)}</td>
                  <td style="vertical-align:top; white-space:normal; color:#9a3412; font-weight:700;">${escapeHtml(row.quantified_impact)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : ""}

      <h3 style="font-size:1.05rem; color:#1e3a5f; margin-bottom:12px;">IV. Phụ lục Bảng Dữ liệu Chuẩn Hóa (${cleanedRows.length} bản ghi)</h3>
      <div class="table-scroll-wrapper" style="max-height:360px; border:1px solid #cbd5e1; border-radius:6px;">
        ${buildSimplePreviewTable(cols, cleanedRows)}
      </div>
    </div>
  `;
  document.getElementById("executiveReportContainer").innerHTML = html;
}

function buildSimplePreviewTable(columns, rows) {
  if (!columns || !columns.length) return "";
  return `
    <table class="data-table">
      <thead>
        <tr>
          ${columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${(rows || []).map(r => `
          <tr>
            ${columns.map(c => `<td>${escapeHtml(String(r[c] ?? ""))}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function downloadCleanedCSV() {
  const rows = AppState.step2Data?.cleaned_rows;
  const cols = AppState.step2Data?.columns;
  if (!rows || !cols) {
    alert("Chưa có dữ liệu làm sạch để tải xuống.");
    return;
  }
  const csvLines = [
    cols.join(","),
    ...rows.map(r => cols.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))
  ];
  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cleaned_bi_data.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMarkdownBold(escapedStr) {
  return escapedStr
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code style='background:#e2e8f0;padding:1px 5px;border-radius:4px;font-size:0.8rem;'>$1</code>");
}
