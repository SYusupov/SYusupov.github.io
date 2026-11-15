// Opens (or comments on) one issue when a publication fails. GitHub mails only the person who
// triggered the run, usually the admin; the issue reaches the repository owner as well.
const fs = require('fs');

const TITLE = 'Публикация сайта не прошла';

module.exports = async ({ github, context, logFiles }) => {
  const { owner, repo } = context.repo;
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const commit = context.payload.head_commit;
  const details = logFiles
    .filter((file) => fs.existsSync(file))
    .map((file) => {
      const text = fs.readFileSync(file, 'utf8').trim();
      return text ? `${file}:\n\`\`\`\n${text.slice(-4000)}\n\`\`\`` : '';
    })
    .filter(Boolean);

  const body = [
    `@${owner}, публикация не прошла, на сайте осталась прежняя версия.`,
    '',
    `Кто запустил: ${context.actor}`,
    commit ? `Изменение: ${commit.id.slice(0, 7)} — ${commit.message.split('\n')[0]}` : '',
    `Подробности: ${runUrl}`,
    '',
    ...(details.length ? details : ['Текст ошибки — по ссылке «Подробности».']),
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n');

  const { data: open } = await github.rest.issues.listForRepo({ owner, repo, state: 'open', per_page: 100 });
  const existing = open.find((issue) => issue.title === TITLE && !issue.pull_request);
  if (existing) {
    await github.rest.issues.createComment({ owner, repo, issue_number: existing.number, body });
  } else {
    await github.rest.issues.create({ owner, repo, title: TITLE, body, assignees: [owner] });
  }
};
