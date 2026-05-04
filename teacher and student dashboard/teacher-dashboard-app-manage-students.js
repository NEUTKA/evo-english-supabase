(function () {
  if (window.__evoTeacherDashboardFullInit) return;
  window.__evoTeacherDashboardFullInit = true;

  console.log('Teacher dashboard script loaded');

  const ROOT_ID = 'teacher-dashboard-app';
  const SUBMISSIONS_BUCKET = 'assignment-submissions';
  const RESOURCES_BUCKET = 'assignment-resources';

  const state = {
    userId: null,
    teacher: null,
    students: [],
    studentsById: new Map(),
    studentLinksById: new Map(),
    assignments: [],
    commentsByAssignment: new Map(),
    resourcesByAssignment: new Map(),
    flash: null
  };

  function rootEl() {
    return document.getElementById(ROOT_ID);
  }

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

  function formatDateTime(value) {
    if (!value) return 'No date';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return 'No date';
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'No date';
    }
  }

  function statusLabel(status) {
    if (status === 'completed') return 'Completed';
    if (status === 'in_progress') return 'In progress';
    return 'Not started';
  }

  function effectiveReviewState(item) {
    if (item?.recipient_status === 'completed' && item?.reviewed_status !== 'reviewed') {
      return 'awaiting_review';
    }
    return item?.reviewed_status === 'reviewed' ? 'reviewed' : 'not_reviewed';
  }

  function effectiveReviewLabel(item) {
    const s = effectiveReviewState(item);
    if (s === 'awaiting_review') return 'Awaiting review';
    if (s === 'reviewed') return 'Reviewed';
    return 'Not reviewed';
  }

  function toIsoFromDatetimeLocal(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function sanitizeFileName(name) {
    return String(name || 'file')
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async function createSignedUrl(bucket, filePath) {
    if (!filePath) return '';
    try {
      const supabase = window.supabase;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
      if (error) return '';
      return data?.signedUrl || '';
    } catch {
      return '';
    }
  }

  function rememberButton(button) {
    if (!button) return { text: '' };
    return { text: button.textContent || '' };
  }

  function paintButton(button, tone, text) {
    if (!button) return;
    button.classList.remove('is-busy', 'is-success', 'is-error');
    if (tone) button.classList.add(`is-${tone}`);
    if (text != null) button.textContent = text;
  }

  function startButtonFeedback(button, busyText) {
    const original = rememberButton(button);
    if (button) {
      button.disabled = true;
      paintButton(button, 'busy', busyText || original.text);
    }
    return original;
  }

  function finishButtonFeedback(button, original, ok, doneText, delay = 1600) {
    if (!button) return;
    button.disabled = true;
    paintButton(button, ok ? 'success' : 'error', doneText);

    window.setTimeout(() => {
      button.disabled = false;
      button.classList.remove('is-busy', 'is-success', 'is-error');
      button.textContent = original?.text || button.textContent;
    }, delay);
  }

  function finishButtonFeedbackBySelector(selector, original, ok, doneText, delay = 1600) {
    const button = rootEl()?.querySelector(selector);
    if (!button) return;
    finishButtonFeedback(button, original, ok, doneText, delay);
  }

  function buttonError(button, original, text) {
    finishButtonFeedback(button, original || rememberButton(button), false, text || 'Failed');
  }
  function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

  function injectStyles() {
    if (document.getElementById('teacher-dashboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'teacher-dashboard-styles';
    style.textContent = `
      #${ROOT_ID}{max-width:980px;margin:32px auto;padding:0 16px 40px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111213}
      #${ROOT_ID} *{box-sizing:border-box}
      .td-wrap{display:grid;gap:18px}
      .td-card{background:#fff;border:1px solid #dfe5ec;border-radius:16px;box-shadow:0 10px 24px rgba(0,0,0,.05);overflow:hidden}
      .td-head{padding:18px 20px;border-bottom:1px solid #eef2f6;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)}
      .td-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4EA9E7;font-weight:700;margin-bottom:6px}
      .td-title{margin:0;font-size:28px;line-height:1.15}
      .td-sub{margin-top:8px;color:#667085;font-size:15px}
      .td-body{padding:18px 20px 20px}
      .td-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
      .td-pill{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid #dbe7f3;background:#f8fbff;color:#0f172a;font-size:14px}
      .td-grid{display:grid;gap:12px}
      .td-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .td-student{border:1px solid #e6ebf1;border-radius:14px;padding:14px 16px;background:#fff}
      .td-student-top{display:flex;align-items:start;justify-content:space-between;gap:12px}
      .td-name{font-size:18px;font-weight:700;line-height:1.2}
      .td-email{margin-top:4px;color:#667085;font-size:14px;overflow-wrap:anywhere}
      .td-badge{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
      .td-badge.active,.td-badge.completed,.td-badge.reviewed{background:#ecfdf3;border:1px solid #b7ebc6;color:#027a48}
      .td-badge.not_started,.td-badge.not_reviewed{background:#f8fbff;border:1px solid #dbe7f3;color:#175cd3}
      .td-badge.in_progress,.td-badge.awaiting_review{background:#fff7ed;border:1px solid #fed7aa;color:#c2410c}
      .td-empty{padding:24px;border:1px dashed #cfd8e3;border-radius:14px;background:#fbfdff;color:#667085;text-align:center}
      .td-error{padding:16px 18px;border-radius:14px;background:#fff2f2;border:1px solid #fecaca;color:#b42318}
      .td-success{padding:16px 18px;border-radius:14px;background:#ecfdf3;border:1px solid #b7ebc6;color:#027a48}
      .td-loading{color:#667085}
      .td-form,.td-section,.td-comments{display:grid;gap:14px}
      .td-label{display:grid;gap:8px}
      .td-label span{font-size:14px;font-weight:700;color:#344054}
      .td-input,.td-select,.td-textarea{width:100%;border:1px solid #d0d5dd;border-radius:12px;background:#fff;color:#111213;font:16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:12px 14px;outline:none}
      .td-textarea{min-height:120px;resize:vertical}
      .td-input:focus,.td-select:focus,.td-textarea:focus{border-color:#4EA9E7;box-shadow:0 0 0 3px rgba(78,169,231,.18)}
      .td-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
      .td-manage-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px;align-items:end}
      .td-manage-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
      .td-note-inline{max-width:320px;line-height:1.45}
      .td-btn-add{min-width:180px}
      .td-btn-compact{padding:10px 14px;font-size:13px;border-radius:10px}
      .td-btn{appearance:none;border:none;border-radius:12px;padding:12px 16px;font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer}
      .td-btn-primary{background:#111213;color:#fff}
      .td-btn-primary:hover,.td-link:hover{filter:brightness(1.05)}
      .td-btn-secondary{background:#f8fbff;color:#175cd3;border:1px solid #dbe7f3}
      .td-btn-danger{background:#fff2f2;color:#b42318;border:1px solid #fecaca}
      .td-btn:disabled{opacity:.65;cursor:not-allowed}
      .td-btn.is-busy{opacity:.92;cursor:wait}
      .td-btn.is-success{background:#22c55e !important;border-color:#22c55e !important;color:#fff !important}
      .td-btn.is-error{background:#ef4444 !important;border-color:#ef4444 !important;color:#fff !important}
      .td-note{color:#667085;font-size:14px}
      .td-assignment{border:1px solid #e6ebf1;border-radius:14px;padding:16px;background:#fff}
      .td-assignment-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .td-assignment-title{font-size:18px;font-weight:700;line-height:1.25}
      .td-assignment-desc{margin-top:8px;color:#475467;font-size:14px;line-height:1.55;white-space:pre-wrap}
      .td-assignment-meta{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}
      .td-tag{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;background:#f8fbff;border:1px solid #dbe7f3;color:#0f172a;font-size:13px}
      .td-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:none;border-radius:12px;padding:11px 14px;font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#111213;color:#fff}
      .td-answer{border:1px solid #e6ebf1;border-radius:12px;padding:12px 14px;background:#fcfcfd;color:#111213;font-size:14px;line-height:1.6;white-space:pre-wrap}
      .td-comments-list,.td-resource-list{display:grid;gap:10px}
      .td-comment,.td-resource{border:1px solid #e6ebf1;border-radius:12px;padding:12px 14px;background:#fff}
      .td-comment.teacher{background:#f8fbff;border-color:#dbe7f3}
      .td-comment.student{background:#fcfcfd}
      .td-comment-meta,.td-resource-meta{font-size:12px;color:#667085;margin-bottom:6px}
      .td-comment-body{font-size:14px;line-height:1.55;color:#111213;white-space:pre-wrap}
      @media (max-width:760px){#${ROOT_ID}{padding:0 12px 28px}.td-head,.td-body{padding:16px}.td-title{font-size:24px}.td-grid-2{grid-template-columns:1fr}.td-student-top,.td-assignment-top{flex-direction:column;align-items:flex-start}.td-manage-row{grid-template-columns:1fr}.td-manage-actions{align-items:flex-start}.td-btn-add{min-width:0;width:100%}.td-note-inline{max-width:none}}
    `;
    document.head.appendChild(style);
  }

  function setLoading() {
    const root = rootEl();
    if (!root) return;
    root.innerHTML = `<div class="td-wrap"><div class="td-card"><div class="td-head"><div class="td-kicker">Teacher dashboard</div><h1 class="td-title">Loading dashboard…</h1><div class="td-sub">Please wait a moment.</div></div><div class="td-body"><div class="td-loading">Loading students and assignments…</div></div></div></div>`;
  }

  function setError(message) {
    const root = rootEl();
    if (!root) return;
    root.innerHTML = `<div class="td-wrap"><div class="td-card"><div class="td-head"><div class="td-kicker">Teacher dashboard</div><h1 class="td-title">Something went wrong</h1><div class="td-sub">The dashboard could not be loaded.</div></div><div class="td-body"><div class="td-error">${escapeHtml(message)}</div></div></div></div>`;
  }

  async function fetchDashboardData() {
    const supabase = window.supabase;
    if (!supabase) throw new Error('Supabase is not available on this page.');

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const user = userData?.user;
    if (!user) throw new Error('User session not found.');
    state.userId = user.id;

    const { data: teacherProfile, error: teacherErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .single();
    if (teacherErr) throw teacherErr;

    const { data: links, error: linksErr } = await supabase
      .from('teacher_students')
      .select('student_id, status, created_at')
      .eq('teacher_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (linksErr) throw linksErr;

    const studentIds = [...new Set((links || []).map((r) => r.student_id).filter(Boolean))];
    const linkMap = new Map((links || []).map((r) => [r.student_id, r]));
    let students = [];

    if (studentIds.length) {
      const { data: studentProfiles, error: studentsErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .in('id', studentIds);
      if (studentsErr) throw studentsErr;

      const byId = new Map((studentProfiles || []).map((p) => [p.id, p]));
      students = studentIds.map((id) => byId.get(id)).filter(Boolean);
    }

    const { data: assignmentsRows, error: assignmentsErr } = await supabase
      .from('assignments')
      .select('id, teacher_id, title, description, due_date, created_at, miro_link')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });
    if (assignmentsErr) throw assignmentsErr;

    const assignmentIds = (assignmentsRows || []).map((a) => a.id);
    let assignments = [];
    let commentsByAssignment = new Map();
    let resourcesByAssignment = new Map();

    if (assignmentIds.length) {
      const { data: recipients, error: recipientsErr } = await supabase
        .from('assignment_recipients')
        .select('assignment_id, student_id, status, created_at, submitted_at, teacher_feedback, reviewed_status, reviewed_at, reviewed_by')
        .in('assignment_id', assignmentIds);
      if (recipientsErr) throw recipientsErr;

      const { data: submissionRows, error: submissionsErr } = await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, student_id, answer_text, file_path, file_name, file_size, mime_type, submitted_at, created_at, updated_at')
        .in('assignment_id', assignmentIds);
      if (submissionsErr) throw submissionsErr;

      const submissionsWithUrls = await Promise.all(
        (submissionRows || []).map(async (row) => ({
          ...row,
          signed_url: row.file_path ? await createSignedUrl(SUBMISSIONS_BUCKET, row.file_path) : ''
        }))
      );
      const submissionsByAssignment = new Map(submissionsWithUrls.map((row) => [row.assignment_id, row]));

      const { data: commentRows, error: commentsErr } = await supabase
        .from('assignment_comments')
        .select('id, assignment_id, student_id, author_id, author_role, body, created_at')
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: true });
      if (commentsErr) throw commentsErr;

      commentsByAssignment = new Map();
      (commentRows || []).forEach((row) => {
        if (!commentsByAssignment.has(row.assignment_id)) commentsByAssignment.set(row.assignment_id, []);
        commentsByAssignment.get(row.assignment_id).push(row);
      });

      const { data: resourceRows, error: resourcesErr } = await supabase
        .from('assignment_resources')
        .select('id, assignment_id, teacher_id, file_path, file_name, file_size, mime_type, created_at')
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: true });
      if (resourcesErr) throw resourcesErr;

      const resourcesWithUrls = await Promise.all(
        (resourceRows || []).map(async (row) => ({
          ...row,
          signed_url: row.file_path ? await createSignedUrl(RESOURCES_BUCKET, row.file_path) : ''
        }))
      );
      resourcesByAssignment = new Map();
      resourcesWithUrls.forEach((row) => {
        if (!resourcesByAssignment.has(row.assignment_id)) resourcesByAssignment.set(row.assignment_id, []);
        resourcesByAssignment.get(row.assignment_id).push(row);
      });

      const recipientsByAssignment = new Map();
      (recipients || []).forEach((r) => recipientsByAssignment.set(r.assignment_id, r));

      assignments = (assignmentsRows || []).map((a) => {
        const recipient = recipientsByAssignment.get(a.id) || null;
        const submission = submissionsByAssignment.get(a.id) || null;
        return {
          ...a,
          student_id: recipient?.student_id || null,
          recipient_status: recipient?.status || 'not_started',
          recipient_created_at: recipient?.created_at || null,
          recipient_submitted_at: recipient?.submitted_at || null,
          teacher_feedback: recipient?.teacher_feedback || '',
          reviewed_status: recipient?.reviewed_status || 'not_reviewed',
          reviewed_at: recipient?.reviewed_at || null,
          reviewed_by: recipient?.reviewed_by || null,
          submission
        };
      });
    }

    state.teacher = teacherProfile;
    state.students = students;
    state.studentsById = new Map(students.map((s) => [s.id, s]));
    state.studentLinksById = linkMap;
    state.assignments = assignments;
    state.commentsByAssignment = commentsByAssignment;
    state.resourcesByAssignment = resourcesByAssignment;
  }

  function renderDashboard() {
    const root = rootEl();
    if (!root) return;

    const teacher = state.teacher || {};
    const students = state.students || [];
    const assignments = state.assignments || [];
    const awaitingReviewCount = assignments.filter((a) => effectiveReviewState(a) === 'awaiting_review').length;
    const teacherName = (teacher.full_name || '').trim() || teacher.email || 'Teacher';
    const teacherEmail = teacher.email || '';
    const flashHtml = state.flash
      ? `<div class="${state.flash.type === 'error' ? 'td-error' : 'td-success'}">${escapeHtml(state.flash.message)}</div>`
      : '';

    const studentOptions = students.length
      ? students.map((student) => {
          const label = ((student.full_name || '').trim() || student.email || 'Student') + ' — ' + (student.email || '');
          return `<option value="${escapeHtml(student.id)}">${escapeHtml(label)}</option>`;
        }).join('')
      : '<option value="">No students available</option>';

    const manageStudentsHtml = students.length
      ? students.map((student) => {
          const fullName = (student.full_name || '').trim() || 'Student';
          const email = student.email || '';
          const link = state.studentLinksById.get(student.id) || null;
          return `
            <div class="td-student">
              <div class="td-student-top">
                <div>
                  <div class="td-name">${escapeHtml(fullName)}</div>
                  <div class="td-email">${escapeHtml(email)}</div>
                  <div class="td-note">Linked: ${escapeHtml(formatDateTime(link?.created_at))}</div>
                </div>
                <div class="td-actions">
                  <div class="td-badge active">${escapeHtml(link?.status || 'active')}</div>
                  <button class="td-btn td-btn-danger td-btn-compact" type="button" data-action="detach-student" data-student-id="${escapeHtml(student.id)}" data-student-email="${escapeHtml(email)}">Detach</button>
                </div>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="td-empty">You do not have any students yet.</div>`;

    const assignmentsHtml = assignments.length
      ? assignments.map((assignment) => {
          const student = assignment.student_id ? state.studentsById.get(assignment.student_id) : null;
          const studentLabel = student?.email || 'Unknown student';
          const submission = assignment.submission || null;
          const comments = state.commentsByAssignment.get(assignment.id) || [];
          const resources = state.resourcesByAssignment.get(assignment.id) || [];
          const effectiveReview = effectiveReviewState(assignment);
          const effectiveReviewText = effectiveReviewLabel(assignment);

          const answerHtml = submission?.answer_text
            ? `<div class="td-answer">${escapeHtml(submission.answer_text)}</div>`
            : `<div class="td-empty">No answer text yet.</div>`;

          const fileHtml = submission?.file_name
            ? `<div class="td-grid" style="gap:8px;"><div class="td-note">${escapeHtml(submission.file_name)} ${submission.file_size ? `(${escapeHtml(Math.round(submission.file_size / 1024) + ' KB')})` : ''}</div>${submission.signed_url ? `<a class="td-link" href="${escapeHtml(submission.signed_url)}" target="_blank" rel="noopener noreferrer">Download file</a>` : ''}</div>`
            : `<div class="td-empty">No file uploaded yet.</div>`;

          const commentsHtml = comments.length
            ? comments.map((comment) => {
                const authorLabel = comment.author_role === 'teacher' ? 'You' : 'Student';
                return `<div class="td-comment ${escapeHtml(comment.author_role)}"><div class="td-comment-meta">${escapeHtml(authorLabel)} • ${escapeHtml(formatDateTime(comment.created_at))}</div><div class="td-comment-body">${escapeHtml(comment.body)}</div></div>`;
              }).join('')
            : `<div class="td-empty">No comments yet.</div>`;

          const resourcesHtml = resources.length
            ? resources.map((resource) => `
                <div class="td-resource">
                  <div class="td-resource-meta">
                    ${escapeHtml(resource.file_name)} • ${escapeHtml(formatDateTime(resource.created_at))}
                    ${resource.file_size ? ` • ${escapeHtml(Math.round(resource.file_size / 1024) + ' KB')}` : ''}
                  </div>
                  <div class="td-actions">
                    ${resource.signed_url ? `<a class="td-link" href="${escapeHtml(resource.signed_url)}" target="_blank" rel="noopener noreferrer">Download</a>` : ''}
                    <button class="td-btn td-btn-danger" type="button" data-action="delete-resource" data-resource-id="${escapeHtml(resource.id)}" data-resource-path="${escapeHtml(resource.file_path)}">Remove</button>
                  </div>
                </div>
              `).join('')
            : `<div class="td-empty">No reference files yet.</div>`;

          return `
            <div class="td-assignment" data-assignment-id="${escapeHtml(assignment.id)}">
              <div class="td-assignment-top">
                <div>
                  <div class="td-assignment-title">${escapeHtml(assignment.title)}</div>
                  <div class="td-assignment-desc">${escapeHtml(assignment.description || 'No description')}</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <div class="td-badge ${escapeHtml(assignment.recipient_status || 'not_started')}">${escapeHtml(statusLabel(assignment.recipient_status))}</div>
                  <div class="td-badge ${escapeHtml(effectiveReview)}">${escapeHtml(effectiveReviewText)}</div>
                </div>
              </div>

              <div class="td-assignment-meta">
                <div class="td-tag">Student: ${escapeHtml(studentLabel)}</div>
                <div class="td-tag">Due: ${escapeHtml(formatDateTime(assignment.due_date))}</div>
                <div class="td-tag">Created: ${escapeHtml(formatDateTime(assignment.created_at))}</div>
                <div class="td-tag">Review: ${escapeHtml(effectiveReviewText)}</div>
                ${assignment.reviewed_at ? `<div class="td-tag">Reviewed at: ${escapeHtml(formatDateTime(assignment.reviewed_at))}</div>` : ''}
                ${submission?.submitted_at ? `<div class="td-tag">Submitted: ${escapeHtml(formatDateTime(submission.submitted_at))}</div>` : ''}
              </div>

              ${assignment.miro_link ? `<div style="margin-top:14px;"><a class="td-link" href="${escapeHtml(assignment.miro_link)}" target="_blank" rel="noopener noreferrer">Open Miro board</a></div>` : ''}

              <div class="td-section">
                <div class="td-label"><span>Reference files</span></div>
                <div class="td-resource-list">${resourcesHtml}</div>
                <div class="td-grid-2">
                  <label class="td-label">
                    <span>Upload new file</span>
                    <input class="td-input" data-role="resource-file" type="file" />
                  </label>
                  <div class="td-actions" style="align-items:end;">
                    <button class="td-btn td-btn-secondary" type="button" data-action="upload-resource">Upload file</button>
                  </div>
                </div>
              </div>

              <div class="td-section">
                <div class="td-label"><span>Student answer</span></div>
                ${answerHtml}
              </div>

              <div class="td-section">
                <div class="td-label"><span>Uploaded file</span></div>
                ${fileHtml}
              </div>

              <div class="td-section">
                <div class="td-label"><span>Teacher review</span></div>
                <div class="td-grid-2">
                  <div class="td-label">
                    <span>Student status</span>
                    <div class="td-answer">${escapeHtml(statusLabel(assignment.recipient_status))}</div>
                  </div>

                  <label class="td-label">
                    <span>Review state</span>
                    <select class="td-select" data-role="reviewed-status">
                      <option value="not_reviewed" ${assignment.reviewed_status === 'not_reviewed' ? 'selected' : ''}>Not reviewed</option>
                      <option value="reviewed" ${assignment.reviewed_status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                    </select>
                  </label>
                </div>

                <label class="td-label">
                  <span>Teacher feedback</span>
                  <textarea class="td-textarea" data-role="teacher-feedback" placeholder="Write feedback for the student.">${escapeHtml(assignment.teacher_feedback || '')}</textarea>
                </label>

                <div class="td-actions">
                  <button class="td-btn td-btn-primary" type="button" data-action="save-review">Save review</button>
                  <div class="td-note">Update review state and feedback.</div>
                </div>
              </div>

              <div class="td-section">
                <div class="td-label"><span>Comments</span></div>
                <div class="td-comments">
                  <div class="td-comments-list">${commentsHtml}</div>
                  <label class="td-label">
                    <span>New comment</span>
                    <textarea class="td-textarea" data-role="comment" placeholder="Write a message to your student."></textarea>
                  </label>
                  <div class="td-actions">
                    <button class="td-btn td-btn-secondary" type="button" data-action="send-comment">Send comment</button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="td-empty">You have not created any assignments yet.</div>`;

    root.innerHTML = `
      <div class="td-wrap">
        ${flashHtml}
        <div class="td-card">
          <div class="td-head">
            <div class="td-kicker">Teacher dashboard</div>
            <h1 class="td-title">Welcome, ${escapeHtml(teacherName)}</h1>
            <div class="td-sub">Here you can manage your students and assignments.</div>
            <div class="td-meta">
              <div class="td-pill">Role: teacher</div>
              <div class="td-pill">${students.length} student${students.length === 1 ? '' : 's'}</div>
              <div class="td-pill">${assignments.length} assignment${assignments.length === 1 ? '' : 's'}</div>
              <div class="td-pill">${awaitingReviewCount} awaiting review</div>
              <div class="td-pill">${escapeHtml(teacherEmail)}</div>
            </div>
          </div>
        </div>

        <div class="td-card">
          <div class="td-head">
            <div class="td-kicker">Students</div>
            <h2 class="td-title" style="font-size:24px;">Manage students</h2>
            <div class="td-sub">Add a registered user by email and manage active student links.</div>
          </div>
          <div class="td-body">
            <form id="td-student-manage-form" class="td-form">
              <div class="td-manage-row">
                <label class="td-label">
                  <span>Student email</span>
                  <input class="td-input" id="td-student-email" type="email" placeholder="student@example.com" />
                </label>

                <div class="td-manage-actions">
                  <button class="td-btn td-btn-primary td-btn-add" id="td-add-student-btn" type="submit">Add student</button>
                  <div class="td-note td-note-inline">Only users who already registered on the site can be added.</div>
                </div>
              </div>
            </form>

            <div class="td-section">
              <div class="td-label"><span>Linked students</span></div>
              <div class="td-grid">${manageStudentsHtml}</div>
            </div>
          </div>
        </div>

        <div class="td-card">
          <div class="td-head">
            <div class="td-kicker">Assignments</div>
            <h2 class="td-title" style="font-size:24px;">Create assignment</h2>
            <div class="td-sub">Create homework and assign it to one of your students.</div>
          </div>
          <div class="td-body">
            <form id="td-assignment-form" class="td-form">
              <div class="td-grid-2">
                <label class="td-label">
                  <span>Student</span>
                  <select class="td-select" id="td-student-id" ${students.length ? '' : 'disabled'}>${studentOptions}</select>
                </label>
                <label class="td-label">
                  <span>Due date</span>
                  <input class="td-input" id="td-due-date" type="datetime-local" />
                </label>
              </div>

              <label class="td-label">
                <span>Title</span>
                <input class="td-input" id="td-title" type="text" placeholder="For example: Writing practice — daily routine" />
              </label>

              <label class="td-label">
                <span>Description</span>
                <textarea class="td-textarea" id="td-description" placeholder="Write the homework instructions here."></textarea>
              </label>

              <label class="td-label">
                <span>Miro link (optional)</span>
                <input class="td-input" id="td-miro-link" type="url" placeholder="https://miro.com/..." />
              </label>

              <div class="td-actions">
                <button class="td-btn td-btn-primary" id="td-submit-btn" type="submit" ${students.length ? '' : 'disabled'}>Create assignment</button>
                <div class="td-note">${students.length ? 'The assignment will be created and assigned immediately.' : 'Add a student first to create an assignment.'}</div>
              </div>
            </form>
          </div>
        </div>

        <div class="td-card">
          <div class="td-head">
            <div class="td-kicker">Assignments</div>
            <h2 class="td-title" style="font-size:24px;">My assignments</h2>
            <div class="td-sub">Assignments created by this teacher account.</div>
          </div>
          <div class="td-body">
            <div class="td-grid">${assignmentsHtml}</div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    state.flash = null;
  }

  function bindEvents() {
    const root = rootEl();
    if (!root || root.__tdBound) return;

    root.addEventListener('submit', async function (event) {
      const assignmentForm = event.target.closest('#td-assignment-form');
      if (assignmentForm) {
        event.preventDefault();
        await handleCreateAssignment(assignmentForm);
        return;
      }

      const studentForm = event.target.closest('#td-student-manage-form');
      if (studentForm) {
        event.preventDefault();
        await handleAddStudent(studentForm);
      }
    });

    root.addEventListener('click', async function (event) {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.getAttribute('data-action');

      if (action === 'detach-student') {
        await handleDetachStudent(button);
        return;
      }

      const card = button.closest('[data-assignment-id]');
      if (!card) return;
      const assignmentId = card.getAttribute('data-assignment-id');
      if (!assignmentId) return;

      if (action === 'send-comment') await handleSendComment(card, assignmentId, button);
      if (action === 'save-review') await handleSaveReview(card, assignmentId, button);
      if (action === 'upload-resource') await handleUploadResource(card, assignmentId, button);
      if (action === 'delete-resource') await handleDeleteResource(button);
    });

    root.__tdBound = true;
  }

  async function handleAddStudent(form) {
    const supabase = window.supabase;
    if (!supabase) return;
    const emailEl = form.querySelector('#td-student-email');
    const addBtn = form.querySelector('#td-add-student-btn');
    const email = emailEl?.value.trim() || '';
    const original = rememberButton(addBtn);

    if (!email) {
      buttonError(addBtn, original, 'Enter email');
      return;
    }

    startButtonFeedback(addBtn, 'Adding...');

    try {
      const { error } = await supabase.rpc('teacher_add_student_by_email', { _email: email });
      if (error) throw error;

      await fetchDashboardData();
      renderDashboard();
      finishButtonFeedbackBySelector('#td-add-student-btn', original, true, 'Added');
    } catch (err) {
      console.error('[teacher-dashboard] add student error:', err);
      buttonError(addBtn, original, 'Failed');
    }
  }

async function handleDetachStudent(button) {
  const supabase = window.supabase;
  if (!supabase) return;

  const studentId = button.getAttribute('data-student-id');
  const studentEmail = button.getAttribute('data-student-email') || 'this student';
  if (!studentId) return;

  if (!confirm(`Detach ${studentEmail} from your student list? Existing assignments will stay in the system.`)) {
    return;
  }

  const original = rememberButton(button);
  startButtonFeedback(button, 'Detaching...');

  try {
    const { error } = await supabase.rpc('teacher_remove_student', { _student_id: studentId });
    if (error) throw error;

    finishButtonFeedback(button, original, true, 'Detached', 900);
    await wait(900);

    await fetchDashboardData();
    renderDashboard();
  } catch (err) {
    console.error('[teacher-dashboard] detach student error:', err);
    buttonError(button, original, 'Failed');
  }
}

  async function handleCreateAssignment(form) {
    const supabase = window.supabase;
    if (!supabase) return;
    const submitBtn = form.querySelector('#td-submit-btn');
    const studentId = form.querySelector('#td-student-id')?.value || '';
    const title = form.querySelector('#td-title')?.value.trim() || '';
    const description = form.querySelector('#td-description')?.value.trim() || '';
    const dueDateRaw = form.querySelector('#td-due-date')?.value || '';
    const miroLink = form.querySelector('#td-miro-link')?.value.trim() || '';
    const original = rememberButton(submitBtn);

    if (!studentId) {
      buttonError(submitBtn, original, 'Choose student');
      return;
    }

    if (!title) {
      buttonError(submitBtn, original, 'Enter title');
      return;
    }

    startButtonFeedback(submitBtn, 'Creating...');

    try {
      const teacherId = state.teacher?.id;
      if (!teacherId) throw new Error('Teacher profile not found.');

      const { data: createdAssignment, error: assignmentErr } = await supabase
        .from('assignments')
        .insert({
          teacher_id: teacherId,
          title,
          description: description || null,
          miro_link: miroLink || null,
          due_date: toIsoFromDatetimeLocal(dueDateRaw)
        })
        .select('id')
        .single();
      if (assignmentErr) throw assignmentErr;

      const { error: recipientErr } = await supabase
        .from('assignment_recipients')
        .insert({
          assignment_id: createdAssignment.id,
          student_id: studentId,
          status: 'not_started',
          reviewed_status: 'not_reviewed'
        });
      if (recipientErr) throw recipientErr;

      await fetchDashboardData();
      renderDashboard();
      finishButtonFeedbackBySelector('#td-submit-btn', original, true, 'Created');
    } catch (err) {
      console.error('[teacher-dashboard] create assignment error:', err);
      buttonError(submitBtn, original, 'Failed');
    }
  }

  async function handleSendComment(card, assignmentId, button) {
    const supabase = window.supabase;
    if (!supabase) return;
    const commentEl = card.querySelector('[data-role="comment"]');
    const body = commentEl?.value.trim() || '';
    const original = rememberButton(button);

    if (!body) {
      buttonError(button, original, 'Write comment');
      return;
    }

    const assignment = state.assignments.find((a) => a.id === assignmentId);
    if (!assignment?.student_id) {
      buttonError(button, original, 'No student');
      return;
    }

    startButtonFeedback(button, 'Sending...');

    try {
      const { error } = await supabase.from('assignment_comments').insert({
        assignment_id: assignmentId,
        student_id: assignment.student_id,
        author_id: state.userId,
        author_role: 'teacher',
        body
      });
      if (error) throw error;

      await fetchDashboardData();
      renderDashboard();
      finishButtonFeedbackBySelector(`[data-assignment-id="${assignmentId}"] [data-action="send-comment"]`, original, true, 'Sent');
    } catch (err) {
      console.error('[teacher-dashboard] send comment error:', err);
      buttonError(button, original, 'Failed');
    }
  }

  async function handleSaveReview(card, assignmentId, button) {
    const supabase = window.supabase;
    if (!supabase) return;

    const reviewedEl = card.querySelector('[data-role="reviewed-status"]');
    const feedbackEl = card.querySelector('[data-role="teacher-feedback"]');
    const reviewedStatus = reviewedEl?.value || 'not_reviewed';
    const teacherFeedback = feedbackEl?.value.trim() || '';
    const original = rememberButton(button);

    const assignment = state.assignments.find((a) => a.id === assignmentId);
    if (!assignment?.student_id) {
      buttonError(button, original, 'No student');
      return;
    }

    startButtonFeedback(button, 'Saving...');

    try {
      const { error } = await supabase
        .from('assignment_recipients')
        .update({
          teacher_feedback: teacherFeedback || null,
          reviewed_status: reviewedStatus,
          reviewed_at: reviewedStatus === 'reviewed' ? new Date().toISOString() : null,
          reviewed_by: reviewedStatus === 'reviewed' ? state.userId : null
        })
        .eq('assignment_id', assignmentId)
        .eq('student_id', assignment.student_id);

      if (error) throw error;

      await fetchDashboardData();
      renderDashboard();
      finishButtonFeedbackBySelector(`[data-assignment-id="${assignmentId}"] [data-action="save-review"]`, original, true, 'Saved');
    } catch (err) {
      console.error('[teacher-dashboard] save review error:', err);
      buttonError(button, original, 'Failed');
    }
  }

  async function handleUploadResource(card, assignmentId, button) {
    const supabase = window.supabase;
    if (!supabase) return;
    const fileEl = card.querySelector('[data-role="resource-file"]');
    const file = fileEl?.files?.[0] || null;
    const original = rememberButton(button);

    if (!file) {
      buttonError(button, original, 'Choose file');
      return;
    }

    startButtonFeedback(button, 'Uploading...');

    try {
      const safeName = sanitizeFileName(file.name || 'file');
      const path = `${state.userId}/${assignmentId}/${Date.now()}-${safeName}`;

      const { error: uploadErr } = await supabase.storage.from(RESOURCES_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream'
      });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from('assignment_resources').insert({
        assignment_id: assignmentId,
        teacher_id: state.userId,
        file_path: path,
        file_name: file.name || safeName,
        file_size: file.size || null,
        mime_type: file.type || null
      });
      if (insertErr) throw insertErr;

      await fetchDashboardData();
      renderDashboard();
      finishButtonFeedbackBySelector(`[data-assignment-id="${assignmentId}"] [data-action="upload-resource"]`, original, true, 'Uploaded');
    } catch (err) {
      console.error('[teacher-dashboard] upload resource error:', err);
      buttonError(button, original, 'Failed');
    }
  }

  async function handleDeleteResource(button) {
    const supabase = window.supabase;
    if (!supabase) return;

    const resourceId = button.getAttribute('data-resource-id');
    const resourcePath = button.getAttribute('data-resource-path');
    const original = rememberButton(button);

    if (!resourceId || !resourcePath) return;
    if (!confirm('Remove this reference file?')) return;

    startButtonFeedback(button, 'Removing...');

    try {
      const { error: storageErr } = await supabase.storage
        .from(RESOURCES_BUCKET)
        .remove([resourcePath]);
      if (storageErr) throw storageErr;

      const { error: deleteErr } = await supabase
        .from('assignment_resources')
        .delete()
        .eq('id', resourceId);
      if (deleteErr) throw deleteErr;

      finishButtonFeedback(button, original, true, 'Removed', 900);
      await wait(900);

      await fetchDashboardData();
      renderDashboard();
    } catch (err) {
      console.error('[teacher-dashboard] delete resource error:', err);
      buttonError(button, original, 'Failed');
    }
  }

  async function loadTeacherDashboard() {
    console.log('Loading teacher dashboard');
    injectStyles();
    setLoading();
    try {
      await fetchDashboardData();
      renderDashboard();
    } catch (err) {
      console.error('[teacher-dashboard] load error:', err);
      setError(err?.message || 'Failed to load dashboard.');
    }
  }

  function start() {
    console.log('Teacher dashboard start called');
    if (!window.__evoAllowTeacherApp) return;
    loadTeacherDashboard();
  }

  if (window.__evoAllowTeacherApp) {
    start();
  } else {
    window.addEventListener('evo:teacher-ready', start, { once: true });
  }
})();