import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1';
const frontendBase = process.env.FRONTEND_BASE_URL ?? 'http://localhost';
const mailBase = process.env.SENDGRID_MOCK_URL ?? 'http://localhost:8025';
const results = [];
const mark = (name) => results.push(name);

async function request(method, path, body, token) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  assert(response.ok, `${method} ${path} returned ${response.status}: ${JSON.stringify(data)}`);
  return data?.data ?? data;
}

async function messages() {
  const response = await fetch(`${mailBase}/__mock/messages`);
  assert(response.ok, 'SendGrid mock message endpoint unavailable');
  return response.json();
}

async function waitForMail(email, subjectPart) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    const found = (await messages()).find((m) => {
      const to = m.personalizations?.flatMap((personalization) => personalization.to?.map((x) => typeof x === 'string' ? x : x.email) ?? [])
        ?? (Array.isArray(m.to) ? m.to.map((x) => typeof x === 'string' ? x : x.email) : [m.to?.email ?? m.to]);
      const subject = m.personalizations?.[0]?.subject ?? m.subject;
      return to.includes(email) && String(subject ?? '').includes(subjectPart);
    });
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`No outbound message to ${email} with subject containing "${subjectPart}"`);
}

function textOf(message) {
  return message?.content?.map((x) => x.value ?? '').join('\n') ?? message?.text ?? '';
}

async function registerAndLogin(email, firstName) {
  const password = 'StagingSmoke123';
  await request('POST', '/auth/register', { email, password, firstName, lastName: 'Smoke' });
  const verificationMail = await waitForMail(email, 'Verify your email');
  const code = textOf(verificationMail).match(/Your code:\s*(\d{6})/)?.[1]
    ?? textOf(verificationMail).match(/\b(\d{6})\b/)?.[1];
  assert(code, `Verification code was absent from mocked message to ${email}`);
  await request('POST', '/auth/verify-email', { email, code });
  const login = await request('POST', '/auth/login', { email, password });
  assert(login.accessToken, 'Login did not return accessToken');
  return login.accessToken;
}

const socketEvent = (socket, event, timeout = 8000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for Socket.IO ${event}`)), timeout);
  socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
});
const ack = (socket, event, payload) => new Promise((resolve, reject) => {
  socket.timeout(5000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result));
});

let socket;
try {
  const clear = await fetch(`${mailBase}/__mock/messages`, { method: 'DELETE' });
  assert(clear.ok, 'Could not reset isolated email mock');
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `smoke-owner-${suffix}@example.test`;
  const inviteeEmail = `smoke-invitee-${suffix}@example.test`;
  const ownerToken = await registerAndLogin(ownerEmail, 'Smoke Owner');
  mark('registration verification email + login');

  const createdProject = await request('POST', '/projects', { name: `Smoke ${suffix}`, description: 'Disposable staging smoke project' }, ownerToken);
  const projectId = createdProject.project?.id ?? createdProject.project?._id ?? createdProject.id ?? createdProject._id;
  assert(projectId, `Unexpected project response: ${JSON.stringify(createdProject)}`);
  const createdBoard = await request('POST', '/projects/' + projectId + '/boards', { name: 'Smoke Board' }, ownerToken);
  const boardId = createdBoard.board?.id ?? createdBoard.board?._id ?? createdBoard.id ?? createdBoard._id;
  assert(boardId, `Unexpected board response: ${JSON.stringify(createdBoard)}`);
  const createTask = (title) => request('POST', '/tasks', {
    projectId, boardId, title, description: 'Smoke check', status: 'todo', priority: 'medium', labels: [], subtasks: [],
  }, ownerToken);
  const initialTask = (await createTask('Staging Smoke Task')).task;

  socket = io(apiBase.replace(/\/api\/v1\/?$/, ''), { transports: ['websocket'], auth: { token: ownerToken }, reconnection: false });
  await socketEvent(socket, 'connect');
  const joined = await ack(socket, 'project:join', { projectId });
  assert.equal(joined.success, true, `Socket join failed: ${JSON.stringify(joined)}`);
  const taskEvent = socketEvent(socket, 'task:created');
  const liveTask = (await createTask('Realtime Smoke Task')).task;
  const emitted = await taskEvent;
  assert.equal(emitted.data.task._id, liveTask._id);
  const commentEvent = socketEvent(socket, 'comment:created');
  const comment = await request('POST', `/tasks/${liveTask._id}/comments`, { body: 'Realtime smoke comment' }, ownerToken);
  assert((comment.comment?._id ?? comment.comment?.id), `Unexpected comment response: ${JSON.stringify(comment)}`);
  const receivedComment = await commentEvent;
  assert.equal(receivedComment.data.comment.body, 'Realtime smoke comment');
  mark('authenticated Socket.IO project join + task and comment events');

  const document = await request('POST', `/projects/${projectId}/docs`, { title: 'Smoke document', content: 'Initial smoke content' }, ownerToken);
  const documentId = document.id ?? document._id ?? document.document?.id ?? document.document?._id;
  assert(documentId, `Unexpected document response: ${JSON.stringify(document)}`);
  const docs = await request('GET', `/projects/${projectId}/docs`, undefined, ownerToken);
  const docItems = Array.isArray(docs) ? docs : docs.items ?? docs.documents ?? [];
  assert(docItems.some((x) => x.id === documentId || x._id === documentId), `Created document missing from project list (${JSON.stringify({ documentId, docs })})`);
  mark('workspace document create + list');

  const invite = await request('POST', `/projects/${projectId}/members`, { email: inviteeEmail, role: 'member' }, ownerToken);
  assert.equal(invite.invitation.pending, true, 'Unregistered invitee was not stored as pending');
  const pending = await request('GET', `/projects/${projectId}/invitations`, undefined, ownerToken);
  assert(pending.invitations?.length, 'Pending invitation missing from list');
  const invitationMail = await waitForMail(inviteeEmail, 'Invitation to join');
  const tokenMatch = textOf(invitationMail).match(/accept-invite\?token=([^\s&]+)/);
  assert(tokenMatch, `Invitation token link absent from mail: ${textOf(invitationMail)}`);
  const inviteToken = decodeURIComponent(tokenMatch[1]);
  const inviteeToken = await registerAndLogin(inviteeEmail, 'Smoke Invitee');
  const accepted = await request('POST', '/projects/invitations/accept', { token: inviteToken }, inviteeToken);
  assert.equal(accepted.invitation.projectId, projectId);
  const members = await request('GET', `/projects/${projectId}/members`, undefined, ownerToken);
  assert(members.members?.some((member) => member.email === inviteeEmail), 'Accepted invitee missing from members');
  mark('unregistered member invite email + registration + token acceptance');

  const summary = await request('GET', `/projects/${projectId}/analytics/summary`, undefined, ownerToken);
  const burndown = await request('GET', `/projects/${projectId}/analytics/burndown?days=14`, undefined, ownerToken);
  assert(summary && burndown, 'Analytics endpoints returned empty response');
  mark('project analytics summary + burndown');

  const insights = await request('POST', '/ai/project-insights', { projectId }, ownerToken);
  assert(insights.recommendations?.length, `No project recommendations returned: ${JSON.stringify(insights)}`);
  const proposal = await request('POST', '/ai/automation/proposals', { projectId, request: `Set high priority for Staging Smoke Task` }, ownerToken);
  const action = proposal.actions?.[0];
  const planId = proposal.id ?? proposal._id;
  const actionId = action?.id ?? action?._id;
  assert(planId && actionId, `No actionable AI proposal returned: ${JSON.stringify(proposal)}`);
  const approved = await request('POST', `/ai/automation/proposals/${planId}/apply`, { actionIds: [actionId] }, ownerToken);
  assert(approved.appliedActionIds?.length, `Approved action was not applied: ${JSON.stringify(approved)}`);
  const activity = await request('GET', `/projects/${projectId}/activity`, undefined, ownerToken);
  const activityItems = Array.isArray(activity) ? activity : activity.items ?? [];
  assert(activityItems.some((x) => x.type === 'ai.approved_plan_applied' || (x.entityType === 'ai' && x.action === 'approved_plan_applied')), `AI approval was not audited: ${JSON.stringify(activity)}`);
  mark('AI context recommendations + approved action + audit entry');

  const upload = await request('POST', '/uploads/presign', {
    kind: 'attachment', fileName: 'smoke.txt', contentType: 'text/plain', contentLength: 20, projectId,
  }, ownerToken);
  assert(upload.uploadUrl && upload.key, `Unexpected presign response: ${JSON.stringify(upload)}`);
  const bytes = Buffer.from('staging upload smoke');
  const put = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: bytes });
  assert(put.ok, `S3-compatible upload failed: ${put.status} ${await put.text()}`);
  const download = await request('POST', '/uploads/download', { projectId, key: upload.key }, ownerToken);
  const got = await fetch(download.url);
  assert(got.ok, `S3-compatible download failed: ${got.status}`);
  assert.deepEqual(Buffer.from(await got.arrayBuffer()), bytes, 'Downloaded upload bytes differed');
  mark('presigned S3-compatible upload + download');

  const outbound = await messages();
  assert(outbound.some((m) => textOf(m).includes(ownerEmail)) || outbound.some((m) => m.personalizations?.[0]?.to?.some((to) => to.email === ownerEmail)), 'Verification outbound email missing');
  assert(outbound.some((m) => m.personalizations?.[0]?.to?.some((to) => to.email === inviteeEmail)), 'Invitation outbound email missing');
  mark('outbound SendGrid-compatible requests observed by local mock');

  const frontend = await fetch(frontendBase);
  assert(frontend.ok && (await frontend.text()).includes('<app-root'), 'Production frontend container did not serve the app shell');
  mark('production frontend HTTP app shell');
  console.log(JSON.stringify({ status: 'passed', checks: results, aiProvider: 'deterministic fallback', email: 'SendGrid HTTP mock', storage: 'LocalStack S3' }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', checksPassed: results, error: error?.stack ?? String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  socket?.disconnect();
}
