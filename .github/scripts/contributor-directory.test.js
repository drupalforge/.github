const assert = require('node:assert/strict');
const test = require('node:test');
const run = require('./contributor-directory');

const DIRECTORY = 'Contributor directory listing';
const MEMBERSHIP = 'GitHub organization membership';
const BOTH = 'GitHub organization membership and a contributor directory listing';
const CLOSES_ISSUE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*(?:[\w.-]+\/[\w.-]+)?#23\b/i;

function issueBody(request) {
  return [
    ...(request === null ? [] : ['### Request', '', request, '']),
    '### Name',
    '',
    'Ada Lovelace',
    '',
    '### Confirmation',
    '',
    '- [x] These accounts belong to the person being listed, who agrees to list them publicly.',
  ].join('\n');
}

function setup(request, { alreadyListed = false, existingPull = false } = {}) {
  const calls = { comments: [], removedLabels: [], issueUpdates: [], commits: [], pulls: [], failures: [] };
  const directory = [
    '# Drupal Forge contributors',
    '',
    '## Directory',
    '',
    '| Name | GitHub | drupal.org | git.drupalcode.org | gitlab.com | Drupal Slack |',
    '| --- | --- | --- | --- | --- | --- |',
    ...(alreadyListed ? ['| Ada Lovelace | [ada](https://github.com/ada) | — | — | — | — |'] : []),
    '',
  ].join('\n');
  const github = {
    rest: {
      issues: {
        createComment: async ({ body }) => { calls.comments.push(body); },
        removeLabel: async ({ name }) => { calls.removedLabels.push(name); },
        update: async (params) => { calls.issueUpdates.push(params); },
      },
      repos: {
        getCollaboratorPermissionLevel: async () => ({ data: { permission: 'write' } }),
        get: async () => ({ data: { default_branch: 'main' } }),
        getContent: async () => ({ data: { content: Buffer.from(directory).toString('base64'), sha: 'file-sha' } }),
        createOrUpdateFileContents: async (params) => { calls.commits.push(params); },
      },
      git: {
        getRef: async () => ({ data: { object: { sha: 'base-sha' } } }),
        updateRef: async () => {},
      },
      pulls: {
        list: async () => ({ data: existingPull ? [{ number: 7 }] : [] }),
        create: async (params) => {
          calls.pulls.push(params);
          return { data: { html_url: 'https://github.com/drupalforge/.github/pull/7' } };
        },
        update: async (params) => {
          calls.pulls.push(params);
          return { data: { html_url: 'https://github.com/drupalforge/.github/pull/7' } };
        },
      },
    },
  };
  const context = {
    repo: { owner: 'drupalforge', repo: '.github' },
    payload: {
      sender: { login: 'maintainer' },
      issue: {
        number: 23,
        user: { login: 'ada' },
        assignees: [{ login: 'ada', type: 'User' }],
        body: issueBody(request),
      },
    },
  };
  const core = { setFailed: (message) => { calls.failures.push(message); } };
  return { calls, github, context, core };
}

test('membership-only requests cannot create a directory listing', async () => {
  for (const request of [MEMBERSHIP, '_No response_', 'Unrecognized request']) {
    const fixture = setup(request);
    await run(fixture);

    assert.deepEqual(fixture.calls.removedLabels, ['add to directory']);
    assert.equal(fixture.calls.failures.length, 1);
    assert.match(fixture.calls.comments[0], /membership/i);
    assert.equal(fixture.calls.commits.length, 0);
    assert.equal(fixture.calls.pulls.length, 0);
    assert.equal(fixture.calls.issueUpdates.length, 0);
  }
});

test('combined requests do not close when their listing pull request is merged', async () => {
  for (const existingPull of [false, true]) {
    const fixture = setup(BOTH, { existingPull });
    await run(fixture);

    assert.equal(fixture.calls.commits.length, 1);
    assert.equal(fixture.calls.pulls.length, 1);
    assert.doesNotMatch(fixture.calls.commits[0].message, CLOSES_ISSUE);
    assert.doesNotMatch(fixture.calls.pulls[0].body, CLOSES_ISSUE);
    assert.match(fixture.calls.pulls[0].body, /membership/i);
    assert.equal(fixture.calls.issueUpdates.length, 0);
  }
});

test('an unchanged listing does not close a combined request', async () => {
  const fixture = setup(BOTH, { alreadyListed: true });
  await run(fixture);

  assert.match(fixture.calls.comments[0], /already up to date/i);
  assert.equal(fixture.calls.issueUpdates.length, 0);
});

test('directory-only and older requests retain automatic closing', async () => {
  for (const request of [DIRECTORY, null]) {
    const fixture = setup(request);
    await run(fixture);

    assert.match(fixture.calls.commits[0].message, /closes #23/i);
    assert.match(fixture.calls.pulls[0].body, /closes #23/i);

    const unchanged = setup(request, { alreadyListed: true });
    await run(unchanged);
    assert.equal(unchanged.calls.issueUpdates[0].state, 'closed');
  }
});

test('directory listings still require a name and explicit consent', async () => {
  const form = run.parseIssueForm('### Name\n\n_No response_\n\n### Confirmation\n\n- [ ] Consent');
  const { errors } = await run.validate(form);

  assert.ok(errors.some((error) => error.includes('**Name**')));
  assert.ok(errors.some((error) => error.includes('**Confirmation**')));
});
