/* eslint-disable no-console */
import * as core from '@actions/core';
import * as github from '@actions/github';
import fs from 'fs';
import path from 'path';

const { context } = github;
const { repository } = context.payload;
const { owner } = repository;

const gh = github.getOctokit(process.env.GITHUB_TOKEN);
const args = { owner: owner.name || owner.login, repo: repository.name };
const cwd = process.env.GITHUB_WORKSPACE;

const getJsonFromFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, filePath), 'utf-8'));
  } catch {
    return {};
  }
};

(async function run() {
  const tags = await gh.paginate(gh.repos.listTags, args);
  const releaseTag = tags.find(
    ({ commit }) => commit.sha === context.payload.commits[context.payload.commits.length - 2].id,
  );

  const repoName = repository.full_name.replace(`/${repository.name}`, '');
  const publishTag = context.payload.head_commit.message.split(`${repoName}/`)[1].split('\n')[0].replace('/', '-');
  const { name } = getJsonFromFile('package.json');

  console.log('---> version', releaseTag.name);
  console.log('---> tag', publishTag);
  console.log('---> packageName', name);

  if (releaseTag) {
    core.setOutput('version', releaseTag.name); // 1.1.1
    core.setOutput('tag', publishTag); // release-are-00
    core.setOutput('packageName', name); // any package name
  }
}());
