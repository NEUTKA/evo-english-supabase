(function () {
  if (window.__evoStudentDashboardFullInit) return;
  window.__evoStudentDashboardFullInit = true;

  const LOGIN_URL = '/login';
  const PERSONAL_URL = '/personal-account';
  const TEACHER_URL = '/teacher-dashboard';
  const STUDENT_URL = '/student-dashboard';
  const ROOT_ID = 'student-dashboard-app';
  const SUBMISSIONS_BUCKET = 'assignment-submissions';
  const RESOURCES_BUCKET = 'assignment-resources';

  const state = {
    userId: null,
    student: null,
    teachers: [],
    teachersById: new Map(),
    assignments: [],
    submissionsByAssignment: new Map(),
    commentsByAssignment: new Map(),
    resourcesByAssignment: new Map(),
    flash: null
  };

  function go(url) {
    if (window.location.pathname !== url) window.location.replace(url);
  }

  function showPage() {
    document.getElementById('student-auth-hide')?.remove();
  }

  function rootEl() {
    return document.getElementById(ROOT_ID);
  }

  function waitSupabase(maxMs = 7000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const t = setInterval(() => {
        if (window.supabase && window.supabase.auth) {
          clearInterval(t);
          resolve(window.supabase);
        } else if (Date.now() - t0 > maxMs) {
          clearInterval(t);
          reject(new Error('supabase not ready'));
        }
      }, 120);
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (m) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m];
    });
  }

  function formatDateTime(value) {
    if (!value) return 'No date';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return 'No date';
      return d.toLocaleString(undefined, {
        year:'numeric',
        month:'short',
        day:'numeric',
        hour:'2-digit',
        minute:'2-digit'
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

  function finishButtonFeedback(button, original, ok, doneText, delay = 1500) {
    if (!button) return;
    button.disabled = true;
    paintButton(button, ok ? 'success' : 'error', doneText);

    window.setTimeout(() => {
      button.disabled = false;
      button.classList.remove('is-busy', 'is-success', 'is-error');
      button.textContent = original?.text || button.textContent;
    }, delay);
  }

  function finishButtonFeedbackBySelector(selector, original, ok, doneText, delay = 1500) {
    const button = rootEl()?.querySelector(selector);
    if (!button) return;
    finishButtonFeedback(button, original, ok, doneText, delay);
  }

  function buttonError(button, original, text) {
    finishButtonFeedback(button, original || rememberButton(button), false, text || 'Failed');
  }

  function setActionMessage(card, role, type, message) {
    const el = card?.querySelector(`[data-role="${role}"]`);
    if (!el) return;
    el.classList.remove('is-info', 'is-success', 'is-warning', 'is-error');
    el.classList.add(`is-${type || 'info'}`);
    el.textContent = message || '';
  }

  function injectStyles() {
    if (document.getElementById('student-dashboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'student-dashboard-styles';
    style.textContent = `
      #${ROOT_ID}{max-width:980px;margin:32px auto;padding:0 16px 40px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111213}
      #${ROOT_ID} *{box-sizing:border-box}
      .sd-wrap{display:grid;gap:18px}
      .sd-card{background:#fff;border:1px solid #dfe5ec;border-radius:16px;box-shadow:0 10px 24px rgba(0,0,0,.05);overflow:hidden}
      .sd-head{padding:18px 20px;border-bottom:1px solid #eef2f6;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)}
      .sd-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4EA9E7;font-weight:700;margin-bottom:6px}
      .sd-title{margin:0;font-size:28px;line-height:1.15}
      .sd-sub{margin-top:8px;color:#667085;font-size:15px}
      .sd-body{padding:18px 20px 20px}
      .sd-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
      .sd-pill{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid #dbe7f3;background:#f8fbff;color:#0f172a;font-size:14px}
      .sd-grid{display:grid;gap:12px}
      .sd-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .sd-teacher{border:1px solid #e6ebf1;border-radius:14px;padding:14px 16px;background:#fff}
      .sd-name{font-size:18px;font-weight:700;line-height:1.2}
      .sd-email{margin-top:4px;color:#667085;font-size:14px;overflow-wrap:anywhere}
      .sd-badge{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
      .sd-badge.completed,.sd-badge.reviewed{background:#ecfdf3;border:1px solid #b7ebc6;color:#027a48}
      .sd-badge.not_started,.sd-badge.not_reviewed{background:#f8fbff;border:1px solid #dbe7f3;color:#175cd3}
      .sd-badge.in_progress,.sd-badge.awaiting_review{background:#fff7ed;border:1px solid #fed7aa;color:#c2410c}
      .sd-empty{padding:24px;border:1px dashed #cfd8e3;border-radius:14px;background:#fbfdff;color:#667085;text-align:center}
      .sd-error{padding:16px 18px;border-radius:14px;background:#fff2f2;border:1px solid #fecaca;color:#b42318}
      .sd-success{padding:16px 18px;border-radius:14px;background:#ecfdf3;border:1px solid #b7ebc6;color:#027a48}
      .sd-loading{color:#667085}
      .sd-assignment{border:1px solid #e6ebf1;border-radius:14px;padding:16px;background:#fff}
      .sd-assignment-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .sd-assignment-title{font-size:18px;font-weight:700;line-height:1.25}
      .sd-assignment-desc{margin-top:8px;color:#475467;font-size:14px;line-height:1.55;white-space:pre-wrap}
      .sd-assignment-meta{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}
      .sd-tag{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;background:#f8fbff;border:1px solid #dbe7f3;color:#0f172a;font-size:13px}
      .sd-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:none;border-radius:12px;padding:11px 14px;font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#111213;color:#fff}
      .sd-link:hover,.sd-btn-primary:hover{filter:brightness(1.05)}
      .sd-form,.sd-comments,.sd-feedback,.sd-materials{display:grid;gap:14px}
      .sd-form,.sd-comments,.sd-feedback,.sd-materials{margin-top:16px;padding-top:16px;border-top:1px solid #eef2f6}
      .sd-label{display:grid;gap:8px}
      .sd-label span{font-size:14px;font-weight:700;color:#344054}
      .sd-input,.sd-select,.sd-textarea{width:100%;border:1px solid #d0d5dd;border-radius:12px;background:#fff;color:#111213;font:16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:12px 14px;outline:none}
      .sd-textarea{min-height:120px;resize:vertical}
      .sd-input:focus,.sd-select:focus,.sd-textarea:focus{border-color:#4EA9E7;box-shadow:0 0 0 3px rgba(78,169,231,.18)}
      .sd-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
      .sd-btn{appearance:none;border:none;border-radius:12px;padding:12px 16px;font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer}
      .sd-btn-primary{background:#111213;color:#fff}
      .sd-btn-secondary{background:#f8fbff;color:#175cd3;border:1px solid #dbe7f3}
      .sd-btn:disabled{opacity:.65;cursor:not-allowed}
      .sd-btn.is-busy{opacity:.92;cursor:wait}
      .sd-btn.is-success{background:#22c55e !important;border-color:#22c55e !important;color:#fff !important}
      .sd-btn.is-error{background:#ef4444 !important;border-color:#ef4444 !important;color:#fff !important}
      .sd-action-message{font-size:13px;color:#667085}
      .sd-action-message.is-success{color:#027a48}
      .sd-action-message.is-error{color:#b42318}
      .sd-note{color:#667085;font-size:14px}
      .sd-file,.sd-material-list,.sd-comments-list{display:grid;gap:10px}
      .sd-file-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .sd-file-meta{color:#667085;font-size:13px;overflow-wrap:anywhere}
      .sd-comment,.sd-material{border:1px solid #e6ebf1;border-radius:12px;padding:12px 14px;background:#fff}
      .sd-comment.teacher{background:#f8fbff;border-color:#dbe7f3}
      .sd-comment.student{background:#fcfcfd}
      .sd-comment-meta,.sd-material-meta{font-size:12px;color:#667085;margin-bottom:6px}
      .sd-comment-body{font-size:14px;line-height:1.55;color:#111213;white-space:pre-wrap}
      .sd-feedback-box{border:1px solid #dbe7f3;border-radius:12px;padding:12px 14px;background:#f8fbff;color:#111213;font-size:14px;line-height:1.6;white-space:pre-wrap}
      @media (max-width:760px){#${ROOT_ID}{padding:0 12px 28px}.sd-head,.sd-body{padding:16px}.sd-title{font-size:24px}.sd-grid-2{grid-template-columns:1fr}.sd-assignment-top{flex-direction:column;align-items:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function setLoading() {
    const root = rootEl();
    if (!root) return;
    root.innerHTML = `<div class="sd-wrap"><div class="sd-card"><div class="sd-head"><div class="sd-kicker">Student dashboard</div><h1 class="sd-title">Loading dashboard…</h1><div class="sd-sub">Please wait a moment.</div></div><div class="sd-body"><div class="sd-loading">Loading teachers and assignments…</div></div></div></div>`;
  }

  function setError(message) {
    const root = rootEl();
    if (!root) return;
    root.innerHTML = `<div class="sd-wrap"><div class="sd-card"><div class="sd-head"><div class="sd-kicker">Student dashboard</div><h1 class="sd-title">Something went wrong</h1><div class="sd-sub">The dashboard could not be loaded.</div></div><div class="sd-body"><div class="sd-error">${escapeHtml(message)}</div></div></div></div>`;
  }

  async function fetchDashboardData(userId) {
    const supabase = window.supabase;
    if (!supabase) throw new Error('Supabase is not available on this page.');

    const { data: studentProfile, error: studentErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .single();
    if (studentErr) throw studentErr;

    const { data: teacherLinks, error: linksErr } = await supabase
      .from('teacher_students')
      .select('teacher_id, status, created_at')
      .eq('student_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (linksErr) throw linksErr;

    const teacherIds = [...new Set((teacherLinks || []).map(r => r.teacher_id).filter(Boolean))];
    let teachers = [];
    if (teacherIds.length) {
      const { data: teacherProfiles, error: teachersErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .in('id', teacherIds);
      if (teachersErr) throw teachersErr;
      const byId = new Map((teacherProfiles || []).map(p => [p.id, p]));
      teachers = teacherIds.map(id => byId.get(id)).filter(Boolean);
    }

    const { data: recipientRows, error: recipientsErr } = await supabase
      .from('assignment_recipients')
      .select('assignment_id, student_id, status, created_at, submitted_at, teacher_feedback, reviewed_status, reviewed_at, reviewed_by')
      .eq('student_id', userId)
      .order('created_at', { ascending: false });
    if (recipientsErr) throw recipientsErr;

    const assignmentIds = [...new Set((recipientRows || []).map(r => r.assignment_id).filter(Boolean))];
    let assignments = [];
    let submissionsByAssignment = new Map();
    let commentsByAssignment = new Map();
    let resourcesByAssignment = new Map();

    if (assignmentIds.length) {
      const { data: assignmentRows, error: assignmentsErr } = await supabase
        .from('assignments')
        .select('id, teacher_id, title, description, due_date, created_at, miro_link')
        .in('id', assignmentIds);
      if (assignmentsErr) throw assignmentsErr;

      const { data: submissionRows, error: submissionsErr } = await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, student_id, answer_text, file_path, file_name, file_size, mime_type, submitted_at, created_at, updated_at')
        .eq('student_id', userId)
        .in('assignment_id', assignmentIds);
      if (submissionsErr) throw submissionsErr;

      const submissionsWithUrls = await Promise.all(
        (submissionRows || []).map(async row => ({
          ...row,
          signed_url: row.file_path ? await createSignedUrl(SUBMISSIONS_BUCKET, row.file_path) : ''
        }))
      );
      submissionsByAssignment = new Map(submissionsWithUrls.map(row => [row.assignment_id, row]));

      const { data: commentRows, error: commentsErr } = await supabase
        .from('assignment_comments')
        .select('id, assignment_id, student_id, author_id, author_role, body, created_at')
        .eq('student_id', userId)
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: true });
      if (commentsErr) throw commentsErr;

      commentsByAssignment = new Map();
      (commentRows || []).forEach(row => {
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
        (resourceRows || []).map(async row => ({
          ...row,
          signed_url: row.file_path ? await createSignedUrl(RESOURCES_BUCKET, row.file_path) : ''
        }))
      );
      resourcesByAssignment = new Map();
      resourcesWithUrls.forEach(row => {
        if (!resourcesByAssignment.has(row.assignment_id)) resourcesByAssignment.set(row.assignment_id, []);
        resourcesByAssignment.get(row.assignment_id).push(row);
      });

      const assignmentsById = new Map((assignmentRows || []).map(a => [a.id, a]));
      assignments = (recipientRows || []).map(recipient => {
        const assignment = assignmentsById.get(recipient.assignment_id);
        if (!assignment) return null;
        const submission = submissionsByAssignment.get(recipient.assignment_id) || null;
        return {
          ...assignment,
          recipient_status: recipient.status || 'not_started',
          recipient_created_at: recipient.created_at || null,
          recipient_submitted_at: recipient.submitted_at || null,
          teacher_feedback: recipient.teacher_feedback || '',
          reviewed_status: recipient.reviewed_status || 'not_reviewed',
          reviewed_at: recipient.reviewed_at || null,
          reviewed_by: recipient.reviewed_by || null,
          submission
        };
      }).filter(Boolean);
    }

    state.userId = userId;
    state.student = studentProfile;
    state.teachers = teachers;
    state.teachersById = new Map(teachers.map(t => [t.id, t]));
    state.assignments = assignments;
    state.submissionsByAssignment = submissionsByAssignment;
    state.commentsByAssignment = commentsByAssignment;
    state.resourcesByAssignment = resourcesByAssignment;
  }

  function renderDashboard() {
    const root = rootEl();
    if (!root) return;

    const student = state.student || {};
    const teachers = state.teachers || [];
    const assignments = state.assignments || [];
    const studentName = (student.full_name || '').trim() || student.email || 'Student';
    const studentEmail = student.email || '';
    const flashHtml = state.flash ? `<div class="${state.flash.type === 'error' ? 'sd-error' : 'sd-success'}">${escapeHtml(state.flash.message)}</div>` : '';

    const teachersHtml = teachers.length
      ? teachers.map(teacher => {
          const teacherName = (teacher.full_name || '').trim() || teacher.email || 'Teacher';
          const teacherEmail = teacher.email || '';
          return `<div class="sd-teacher"><div class="sd-name">${escapeHtml(teacherName)}</div><div class="sd-email">${escapeHtml(teacherEmail)}</div></div>`;
        }).join('')
      : `<div class="sd-empty">No active teacher is linked to this account yet.</div>`;

    const assignmentsHtml = assignments.length
      ? assignments.map(assignment => {
          const teacher = teachers.find(t => t.id === assignment.teacher_id);
          const teacherLabel = teacher?.email || 'Unknown teacher';
          const hasMiro = !!assignment.miro_link;
          const submission = assignment.submission || null;
          const comments = state.commentsByAssignment.get(assignment.id) || [];
          const resources = state.resourcesByAssignment.get(assignment.id) || [];
          const hasFeedback = !!(assignment.teacher_feedback || '').trim();
          const effectiveReview = effectiveReviewState(assignment);
          const effectiveReviewText = effectiveReviewLabel(assignment);

          const fileInfo = submission?.file_name
            ? `<div class="sd-file"><div class="sd-file-meta">Current file: ${escapeHtml(submission.file_name)} ${submission.file_size ? `(${escapeHtml(Math.round(submission.file_size / 1024) + ' KB')})` : ''}</div><div class="sd-file-row">${submission.signed_url ? `<a class="sd-link" href="${escapeHtml(submission.signed_url)}" target="_blank" rel="noopener noreferrer">Download file</a>` : ''}</div></div>`
            : '';

          const commentsHtml = comments.length
            ? comments.map(comment => {
                const authorLabel = comment.author_role === 'teacher' ? 'Teacher' : 'You';
                return `<div class="sd-comment ${escapeHtml(comment.author_role)}"><div class="sd-comment-meta">${escapeHtml(authorLabel)} • ${escapeHtml(formatDateTime(comment.created_at))}</div><div class="sd-comment-body">${escapeHtml(comment.body)}</div></div>`;
              }).join('')
            : `<div class="sd-empty">No comments yet.</div>`;

          const materialsHtml = resources.length
            ? resources.map(resource => `<div class="sd-material"><div class="sd-material-meta">${escapeHtml(resource.file_name)} • ${escapeHtml(formatDateTime(resource.created_at))}${resource.file_size ? ` • ${escapeHtml(Math.round(resource.file_size / 1024) + ' KB')}` : ''}</div>${resource.signed_url ? `<a class="sd-link" href="${escapeHtml(resource.signed_url)}" target="_blank" rel="noopener noreferrer">Download material</a>` : ''}</div>`).join('')
            : `<div class="sd-empty">No teacher materials yet.</div>`;

          return `
            <div class="sd-assignment" data-assignment-id="${escapeHtml(assignment.id)}">
              <div class="sd-assignment-top">
                <div>
                  <div class="sd-assignment-title">${escapeHtml(assignment.title)}</div>
                  <div class="sd-assignment-desc">${escapeHtml(assignment.description || 'No description')}</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <div class="sd-badge ${escapeHtml(assignment.recipient_status || 'not_started')}">${escapeHtml(statusLabel(assignment.recipient_status))}</div>
                  <div class="sd-badge ${escapeHtml(effectiveReview)}">${escapeHtml(effectiveReviewText)}</div>
                </div>
              </div>

              <div class="sd-assignment-meta">
                <div class="sd-tag">Teacher: ${escapeHtml(teacherLabel)}</div>
                <div class="sd-tag">Due: ${escapeHtml(formatDateTime(assignment.due_date))}</div>
                <div class="sd-tag">Created: ${escapeHtml(formatDateTime(assignment.created_at))}</div>
                <div class="sd-tag">Review: ${escapeHtml(effectiveReviewText)}</div>
                ${assignment.reviewed_at ? `<div class="sd-tag">Reviewed at: ${escapeHtml(formatDateTime(assignment.reviewed_at))}</div>` : ''}
                ${submission?.submitted_at ? `<div class="sd-tag">Submitted: ${escapeHtml(formatDateTime(submission.submitted_at))}</div>` : ''}
              </div>

              ${hasMiro ? `<div style="margin-top:14px;"><a class="sd-link" href="${escapeHtml(assignment.miro_link)}" target="_blank" rel="noopener noreferrer">Open Miro board</a></div>` : ''}

              <div class="sd-materials">
                <div class="sd-label"><span>Teacher materials</span></div>
                <div class="sd-material-list">${materialsHtml}</div>
              </div>

              <div class="sd-feedback">
                <div class="sd-label"><span>Teacher feedback</span></div>
                ${hasFeedback ? `<div class="sd-feedback-box">${escapeHtml(assignment.teacher_feedback)}</div>` : `<div class="sd-empty">No feedback from teacher yet.</div>`}
              </div>

              <div class="sd-form">
                <div class="sd-grid-2">
                  <label class="sd-label">
                    <span>Status</span>
                    <select class="sd-select" data-role="status">
                      <option value="not_started" ${assignment.recipient_status === 'not_started' ? 'selected' : ''}>Not started</option>
                      <option value="in_progress" ${assignment.recipient_status === 'in_progress' ? 'selected' : ''}>In progress</option>
                      <option value="completed" ${assignment.recipient_status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                  </label>
                  <label class="sd-label">
                    <span>Answer file</span>
                    <input class="sd-input" data-role="file" type="file" />
                  </label>
                </div>

                <label class="sd-label">
                  <span>My answer</span>
                  <textarea class="sd-textarea" data-role="answer" placeholder="Write your answer here.">${escapeHtml(submission?.answer_text || '')}</textarea>
                </label>

                ${fileInfo}

                <div class="sd-actions">
                  <button class="sd-btn sd-btn-primary" type="button" data-action="save-work">Save progress</button>
                  <div class="sd-action-message is-info" data-role="work-message">Save your status, text answer, and optional file.</div>
                </div>
              </div>

              <div class="sd-comments">
                <div class="sd-label"><span>Comments</span></div>
                <div class="sd-comments-list">${commentsHtml}</div>
                <label class="sd-label">
                  <span>New comment</span>
                  <textarea class="sd-textarea" data-role="comment" placeholder="Write a message to your teacher."></textarea>
                </label>
                <div class="sd-actions">
                  <button class="sd-btn sd-btn-secondary" type="button" data-action="send-comment">Send comment</button>
                  <div class="sd-action-message is-info" data-role="comment-message">Write a message to your teacher.</div>
                </div>
              </div>
            </div>`;
        }).join('')
      : `<div class="sd-empty">You do not have any assignments yet.</div>`;

    root.innerHTML = `
      <div class="sd-wrap">
        ${flashHtml}
        <div class="sd-card">
          <div class="sd-head">
            <div class="sd-kicker">Student dashboard</div>
            <h1 class="sd-title">Welcome, ${escapeHtml(studentName)}</h1>
            <div class="sd-sub">Here you can see your teachers and all assignments sent to you.</div>
            <div class="sd-meta">
              <div class="sd-pill">Role: student</div>
              <div class="sd-pill">${teachers.length} teacher${teachers.length === 1 ? '' : 's'}</div>
              <div class="sd-pill">${assignments.length} assignment${assignments.length === 1 ? '' : 's'}</div>
              <div class="sd-pill">${escapeHtml(studentEmail)}</div>
            </div>
          </div>
        </div>

        <div class="sd-card">
          <div class="sd-head">
            <div class="sd-kicker">Teachers</div>
            <h2 class="sd-title" style="font-size:24px;">My teachers</h2>
            <div class="sd-sub">These teachers are linked to your account.</div>
          </div>
          <div class="sd-body">
            <div class="sd-grid ${teachers.length > 1 ? 'sd-grid-2' : ''}">${teachersHtml}</div>
          </div>
        </div>

        <div class="sd-card">
          <div class="sd-head">
            <div class="sd-kicker">Assignments</div>
            <h2 class="sd-title" style="font-size:24px;">My assignments</h2>
            <div class="sd-sub">Assignments that teachers have already assigned to you.</div>
          </div>
          <div class="sd-body">
            <div class="sd-grid">${assignmentsHtml}</div>
          </div>
        </div>
      </div>`;

    bindEvents();
    state.flash = null;
  }

  function bindEvents() {
    const root = rootEl();
    if (!root || root.__sdBound) return;

    root.addEventListener('click', async function (event) {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const action = button.getAttribute('data-action');
      const card = button.closest('[data-assignment-id]');
      if (!card) return;

      const assignmentId = card.getAttribute('data-assignment-id');
      if (!assignmentId) return;

      if (action === 'save-work') await handleSaveWork(card, assignmentId, button);
      if (action === 'send-comment') await handleSendComment(card, assignmentId, button);
    });

    root.__sdBound = true;
  }

  async function handleSaveWork(card, assignmentId, button) {
    const supabase = window.supabase;
    if (!supabase) return;

    const statusEl = card.querySelector('[data-role="status"]');
    const answerEl = card.querySelector('[data-role="answer"]');
    const fileEl = card.querySelector('[data-role="file"]');
    const nextStatus = statusEl?.value || 'not_started';
    const answerText = answerEl?.value.trim() || '';
    const file = fileEl?.files?.[0] || null;
    const studentId = state.userId;
    const existingSubmission = state.submissionsByAssignment.get(assignmentId) || null;

    const original = startButtonFeedback(button, 'Saving...');
    setActionMessage(card, 'work-message', 'info', 'Saving your progress...');

    try {
      const { error: statusErr } = await supabase
        .from('assignment_recipients')
        .update({ status: nextStatus })
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId);
      if (statusErr) throw statusErr;

      let filePayload = {
        file_path: existingSubmission?.file_path || null,
        file_name: existingSubmission?.file_name || null,
        file_size: existingSubmission?.file_size || null,
        mime_type: existingSubmission?.mime_type || null
      };

      if (file) {
        const safeName = sanitizeFileName(file.name || 'file');
        const path = `${studentId}/${assignmentId}/${Date.now()}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from(SUBMISSIONS_BUCKET)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream'
          });
        if (uploadErr) throw uploadErr;

        if (existingSubmission?.file_path && existingSubmission.file_path !== path) {
          await supabase.storage.from(SUBMISSIONS_BUCKET).remove([existingSubmission.file_path]);
        }

        filePayload = {
          file_path: path,
          file_name: file.name || safeName,
          file_size: file.size || null,
          mime_type: file.type || null
        };
      }

      const hasSomethingToStore = answerText || filePayload.file_path || existingSubmission;

      if (hasSomethingToStore) {
        const payload = {
          assignment_id: assignmentId,
          student_id: studentId,
          answer_text: answerText || null,
          file_path: filePayload.file_path,
          file_name: filePayload.file_name,
          file_size: filePayload.file_size,
          mime_type: filePayload.mime_type,
          submitted_at: new Date().toISOString()
        };

        const { error: submissionErr } = await supabase
          .from('assignment_submissions')
          .upsert(payload, { onConflict: 'assignment_id,student_id' });
        if (submissionErr) throw submissionErr;
      }

      await fetchDashboardData(studentId);
      renderDashboard();
      const newCard = rootEl()?.querySelector(`[data-assignment-id="${assignmentId}"]`);
      setActionMessage(newCard, 'work-message', 'success', 'Progress saved successfully.');
      finishButtonFeedbackBySelector(`[data-assignment-id="${assignmentId}"] [data-action="save-work"]`, original, true, 'Saved');
    } catch (err) {
      console.error('[student-dashboard] save work error:', err);
      setActionMessage(card, 'work-message', 'error', err?.message || 'Failed to save your progress.');
      finishButtonFeedback(button, original, false, 'Failed');
    }
  }

  async function handleSendComment(card, assignmentId, button) {
    const supabase = window.supabase;
    if (!supabase) return;

    const commentEl = card.querySelector('[data-role="comment"]');
    const body = commentEl?.value.trim() || '';
    const studentId = state.userId;

    const original = rememberButton(button);

    if (!body) {
      buttonError(button, original, 'Write comment');
      setActionMessage(card, 'comment-message', 'error', 'Please enter a comment before sending.');
      return;
    }

    startButtonFeedback(button, 'Sending...');
    setActionMessage(card, 'comment-message', 'info', 'Sending comment...');

    try {
      const { error } = await supabase
        .from('assignment_comments')
        .insert({
          assignment_id: assignmentId,
          student_id: studentId,
          author_id: studentId,
          author_role: 'student',
          body
        });
      if (error) throw error;

      await fetchDashboardData(studentId);
      renderDashboard();
      const newCard = rootEl()?.querySelector(`[data-assignment-id="${assignmentId}"]`);
      setActionMessage(newCard, 'comment-message', 'success', 'Comment sent.');
      finishButtonFeedbackBySelector(`[data-assignment-id="${assignmentId}"] [data-action="send-comment"]`, original, true, 'Sent');
    } catch (err) {
      console.error('[student-dashboard] send comment error:', err);
      setActionMessage(card, 'comment-message', 'error', err?.message || 'Failed to send comment.');
      finishButtonFeedback(button, original, false, 'Failed');
    }
  }

  async function boot() {
    try {
      const sb = await waitSupabase();

      const { data: userData, error: userErr } = await sb.auth.getUser();
      if (userErr) console.warn('[student-dashboard] getUser:', userErr.message);

      const user = userData?.user;
      if (!user) {
        go(LOGIN_URL);
        return;
      }

      const { data: profile, error: profileErr } = await sb
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileErr) {
        console.warn('[student-dashboard] profile fetch:', profileErr.message);
        go(LOGIN_URL);
        return;
      }

      const role = profile?.role || 'self_study';

      if (role === 'teacher') {
        go(TEACHER_URL);
        return;
      }

      if (role !== 'student') {
        go(PERSONAL_URL);
        return;
      }

      if (window.location.pathname !== STUDENT_URL) {
        go(STUDENT_URL);
        return;
      }

      injectStyles();
      showPage();
      setLoading();

      await fetchDashboardData(user.id);
      renderDashboard();
    } catch (err) {
      console.error('[student-dashboard] load error:', err);
      showPage();
      injectStyles();
      setError(err?.message || 'Failed to load dashboard.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();