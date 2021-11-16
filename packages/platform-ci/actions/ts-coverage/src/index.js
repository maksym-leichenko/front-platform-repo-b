import * as core from '@actions/core';
import * as github from '@actions/github';

import { filterFiles, mapCommitData, checkFiles } from './utils';

const { context } = github;
const { repository } = context.payload;
const { owner } = repository;

const gh = github.getOctokit(process.env.GITHUB_TOKEN);
const args = { owner: owner.name || owner.login, repo: repository.name };

const getCommits = () => (
  gh.pulls.listFiles({ ...args, pull_number: context.payload.pull_request.number })
);

(async function run() {
  getCommits().then((res) => {
    Promise.resolve(res.data)
      .then(mapCommitData)
      .then(files => filterFiles(files, process.env.IGNORE))
      .then(checkFiles)
      .then(errorsFiles => {
        if (errorsFiles.length) {
          const errors = errorsFiles.map(file => file.name);
          core.setFailed(`All new files should be in TS. Please fix the next files:\n${errors.join('\n')}`);
        }
      });
  });
}());
