// Adds or updates the issue assignee's row in CONTRIBUTORS.md and opens a pull
// request. Run by the contributor-directory workflow through actions/github-script.

const FILE = 'CONTRIBUTORS.md';
const APPROVAL_LABEL = 'add to directory';
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]{0,99}$/u;
const SLACK_PATTERN = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ._'’-]{0,79}$/u;
const DRUPAL_ORG_PATTERN = /^[\p{L}\p{M}\p{N} ._'@-]{1,60}$/u;
const GITLAB_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,254}$/;

const FIELDS = {
  name: 'Name',
  drupalOrg: 'drupal.org username',
  drupalCode: 'git.drupalcode.org username',
  gitlab: 'gitlab.com username',
  slack: 'Drupal Slack display name',
  confirm: 'Confirmation',
};

// Issue forms render each field as "### Label" followed by its value.
function parseIssueForm(body) {
  const values = {};
  for (const section of (body || '').split(/^### /m).slice(1)) {
    const newline = section.indexOf('\n');
    const label = (newline === -1 ? section : section.slice(0, newline)).trim();
    const value = newline === -1 ? '' : section.slice(newline + 1).trim();
    values[label] = value === '_No response_' ? '' : value;
  }
  return values;
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`${new URL(url).host} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function findDrupalOrgUser(name) {
  const data = await getJson(
    `https://www.drupal.org/api-d7/user.json?name=${encodeURIComponent(name)}`,
  );
  const user = (data.list || []).find(
    (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
  );
  return user && { name: user.name, url: user.url || `https://www.drupal.org/user/${user.uid}` };
}

async function findGitLabUser(host, username) {
  const users = await getJson(
    `https://${host}/api/v4/users?username=${encodeURIComponent(username)}`,
  );
  const user = users.find((candidate) => candidate.state === 'active');
  return user && { name: user.username, url: user.web_url };
}

async function validate(form) {
  const errors = [];
  const name = form[FIELDS.name] || '';
  const slack = (form[FIELDS.slack] || '').replace(/^@/, '');
  const accounts = {};

  if (!NAME_PATTERN.test(name)) {
    errors.push(`**${FIELDS.name}** must be 1–100 letters, spaces, or . ' - characters.`);
  }
  if (slack && !SLACK_PATTERN.test(slack)) {
    errors.push(`**${FIELDS.slack}** must be 1–80 letters, numbers, spaces, or . _ ' - characters.`);
  }
  if (!/^- \[[xX]\]/m.test(form[FIELDS.confirm] || '')) {
    errors.push(`Check the **${FIELDS.confirm}** box.`);
  }

  const lookups = [
    ['drupalOrg', DRUPAL_ORG_PATTERN, (value) => findDrupalOrgUser(value)],
    ['drupalCode', GITLAB_PATTERN, (value) => findGitLabUser('git.drupalcode.org', value)],
    ['gitlab', GITLAB_PATTERN, (value) => findGitLabUser('gitlab.com', value)],
  ];
  for (const [key, pattern, lookup] of lookups) {
    const value = form[FIELDS[key]] || '';
    if (!value) continue;
    if (!pattern.test(value)) {
      errors.push(`**${FIELDS[key]}** \`${value}\` isn't a valid username.`);
      continue;
    }
    try {
      accounts[key] = await lookup(value);
      if (!accounts[key]) errors.push(`**${FIELDS[key]}**: no active account named \`${value}\`.`);
    } catch (error) {
      errors.push(`**${FIELDS[key]}**: couldn't check \`${value}\` (${error.message}). Try again later.`);
    }
  }

  return { errors, name, slack, accounts };
}

function link(account) {
  return account ? `[${account.name}](${account.url})` : '—';
}

function buildRow(login, { name, slack, accounts }) {
  return `| ${[
    name,
    `[${login}](https://github.com/${login})`,
    link(accounts.drupalOrg),
    link(accounts.drupalCode),
    link(accounts.gitlab),
    slack ? `@${slack}` : '—',
  ].join(' | ')} |`;
}

const rowName = (row) => row.split('|')[1].trim();

// Replaces any row for the same GitHub account, then sorts rows by name.
function upsertRow(markdown, login, row) {
  const lines = markdown.split('\n');
  const heading = lines.indexOf('## Directory');
  const header = lines.findIndex((line, index) => index > heading && line.startsWith('| Name |'));
  if (heading === -1 || header === -1) {
    throw new Error(`Couldn't find the directory table in ${FILE}.`);
  }
  const start = header + 2;
  let end = start;
  while (end < lines.length && lines[end].startsWith('|')) end += 1;

  const githubCell = `(https://github.com/${login.toLowerCase()})`;
  const rows = lines
    .slice(start, end)
    .filter((line) => !line.toLowerCase().includes(githubCell));
  const replaced = rows.length < end - start;
  rows.push(row);
  rows.sort((a, b) => rowName(a).localeCompare(rowName(b), 'en', { sensitivity: 'base' }));
  lines.splice(start, end - start, ...rows);
  return { markdown: lines.join('\n'), replaced };
}

module.exports = async function run({ github, context, core }) {
  const { owner, repo } = context.repo;
  const issue = context.payload.issue;
  const assignees = issue.assignees || [];
  const login = assignees.length === 1 ? assignees[0].login : '';

  const comment = (body) =>
    github.rest.issues.createComment({ owner, repo, issue_number: issue.number, body });
  const fail = async (message) => {
    await comment(message);
    await github.rest.issues
      .removeLabel({ owner, repo, issue_number: issue.number, name: APPROVAL_LABEL })
      .catch(() => {});
    core.setFailed(message);
  };

  // Triage access is enough to add labels, so require write access to approve.
  const { data: permission } = await github.rest.repos.getCollaboratorPermissionLevel({
    owner,
    repo,
    username: context.payload.sender.login,
  });
  if (!['admin', 'maintain', 'write'].includes(permission.permission)) {
    return fail(`Only maintainers can approve directory listings, so the \`${APPROVAL_LABEL}\` label was removed.`);
  }
  // The assignee, not the issue author, is the GitHub account that gets listed.
  if (!login) {
    return fail(
      `Assign this issue to exactly one GitHub account, the one to list, then add the \`${APPROVAL_LABEL}\` label again.`,
    );
  }
  if (assignees[0].type !== 'User') {
    return fail('Only personal GitHub accounts can be listed in the contributor directory.');
  }

  const result = await validate(parseIssueForm(issue.body));
  if (result.errors.length) {
    return fail(
      `@${issue.user.login}, please edit this issue to fix the following. A maintainer will then review it again.\n\n` +
        result.errors.map((error) => `- ${error}`).join('\n'),
    );
  }

  const { data: repository } = await github.rest.repos.get({ owner, repo });
  const base = repository.default_branch;
  const { data: file } = await github.rest.repos.getContent({ owner, repo, path: FILE, ref: base });
  const current = Buffer.from(file.content, 'base64').toString('utf8');
  const row = buildRow(login, result);
  const { markdown, replaced } = upsertRow(current, login, row);

  if (markdown === current) {
    await comment(`Your listing is already up to date:\n\n${row}`);
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed',
      state_reason: 'completed',
    });
    return;
  }

  // Reset the branch to the default branch so reruns pick up issue edits.
  // Updating the ref instead of deleting it keeps an open pull request open.
  const branch = `contributor-directory/issue-${issue.number}`;
  const { data: baseRef } = await github.rest.git.getRef({ owner, repo, ref: `heads/${base}` });
  try {
    await github.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: baseRef.object.sha,
      force: true,
    });
  } catch (error) {
    if (error.status !== 404 && error.status !== 422) throw error;
    await github.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseRef.object.sha,
    });
  }

  const verb = replaced ? 'update' : 'add';
  await github.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: FILE,
    branch,
    sha: file.sha,
    message: `docs: ${verb} ${login} in the contributor directory\n\nCloses #${issue.number}`,
    content: Buffer.from(markdown).toString('base64'),
  });

  const body = [
    `${replaced ? 'Updates' : 'Adds'} @${login}'s row in the contributor directory, as requested in #${issue.number}.`,
    '',
    '| Name | GitHub | drupal.org | git.drupalcode.org | gitlab.com | Drupal Slack |',
    '| --- | --- | --- | --- | --- | --- |',
    row,
    '',
    `Closes #${issue.number}`,
  ].join('\n');
  const { data: existing } = await github.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${branch}`,
  });
  const { data: pull } = existing[0]
    ? await github.rest.pulls.update({ owner, repo, pull_number: existing[0].number, body })
    : await github.rest.pulls.create({
        owner,
        repo,
        base,
        head: branch,
        title: `Contributor directory: ${verb} ${login}`,
        body,
      });

  await comment(`Opened ${pull.html_url} for your listing. It will appear in the directory once the pull request is merged.`);
};

Object.assign(module.exports, { parseIssueForm, validate, buildRow, upsertRow });
